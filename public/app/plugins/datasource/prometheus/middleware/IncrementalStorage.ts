import { cloneDeep } from 'lodash';

import {
  ArrayVector,
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  dateTime,
  Field,
  FieldDTO,
  rangeUtil,
  TIME_SERIES_TIME_FIELD_NAME,
  TimeRange,
} from '@grafana/data/src';
import { applyNullInsertThreshold } from '@grafana/ui/src/components/GraphNG/nullInsertThreshold';

import { getTimeSrv, TimeSrv } from '../../../../features/dashboard/services/TimeSrv';
import { LokiQuery } from '../../loki/types';
import { alignRange } from '../datasource';
import { PromQuery } from '../types';

// Decreasing the duration of the overlap provides even further performance improvements, however prometheus data over the last 10 minutes is in flux, and could be out of order from the past 2 hours
// Get link to prometheus doc for the above comment
const INCREMENTAL_QUERY_OVERLAP_DURATION_MS = 60 * 10 * 1000;
const STORAGE_TIME_INDEX = '__time__';
const DEBUG = false;

interface IncrementalStorageOptions {
  queryOverlapDurationMs: number;
  storageTimeIndex: string;
  debug: boolean;
}

export class IncrementalStorage {
  private storage: Record<string, Record<string, number[]>>;
  private readonly datasource: { interpolateString: (s: string) => string };
  private readonly timeSrv: TimeSrv = getTimeSrv();
  // Not currently in use @todo
  private readonly options?: IncrementalStorageOptions;

  constructor(datasource: { interpolateString: (s: string) => string }, options?: IncrementalStorageOptions) {
    this.storage = {};
    this.datasource = datasource;
    this.options = options;
  }

  throwError = (error: Error) => {
    if (DEBUG) {
      console.error('Fatal storage error:', error);
      console.log('Storage state before clear', this.storage);
    }
    // Wipe storage
    this.storage = {};

    // Let calling context handle exceptions?
    throw error;
  };

  /**
   * Get index for flat storage
   * @param valueField
   */
  private static valueFieldToLabelsString = (valueField: FieldDTO | Field): string => {
    let keyValues: Array<{ key: string; value: string | undefined }> = [];

    if (valueField?.labels) {
      const keys = Object.keys(valueField?.labels ?? {});
      keys.forEach((key) => {
        keyValues.push({
          key,
          value: valueField?.labels && key in valueField?.labels ? valueField.labels[key] : undefined,
        });
      });
    } else {
      // If there are no labels then this query should only be for a single series
      // This will return '{}' as the index for this series, this should work as long as this is indeed the only series returned by this query
      // @todo throw an error when there are more than one series without labels
    }

    // @todo faster
    return JSON.stringify(keyValues);
  };

  /**
   * This function takes time values from the request and storage, and the values from storage,
   * and gets the indices from the beginning and end of the time values from storage, that don't overlap with existing values from the request
   * and uses those to splice the values and times in storage, and return the de-duped arrays to the calling function.
   * This should always return any new values from the request that overlap with those in storage.
   *
   * @param timeValuesFromStorage
   * @param timeValuesFromResponse
   * @param originalRange
   * @param valuesFromStorage
   * @param intervalInSeconds
   * @private
   */
  private static removeFramesFromStorageThatExistInRequest(
    timeValuesFromStorage: number[],
    timeValuesFromResponse: number[],
    originalRange: { end: number; start: number },
    valuesFromStorage: number[],
    intervalInSeconds: number
  ) {
    let timeValuesFromStorageNoOverlapWithResponse: number[] = [];
    let indiciesOfValuesInStorageToMergeWithResponse: { start: undefined | number; end: undefined | number } = {
      start: undefined,
      end: undefined,
    };
    let existingValueFrameNewValuesRemoved: number[] = [];

    // Start at the beginning of the array and walk until we find a frame index
    for (let i = 0; i < timeValuesFromStorage?.length; i++) {
      const startIndex = this.getValidFrameIndex(
        timeValuesFromResponse,
        timeValuesFromStorage,
        i,
        originalRange,
        intervalInSeconds,
        valuesFromStorage,
        true
      );

      if (startIndex !== false && startIndex >= 0) {
        indiciesOfValuesInStorageToMergeWithResponse.start = startIndex;
        break;
      }
    }

    // Then go to the end and walk backwards until we find a valid frame index
    for (let i = timeValuesFromStorage?.length - 1; i >= 0; i--) {
      const endIndex = this.getValidFrameIndex(
        timeValuesFromResponse,
        timeValuesFromStorage,
        i,
        originalRange,
        intervalInSeconds,
        valuesFromStorage,
        false // don't evict from end, only start
      );

      if (endIndex !== false && endIndex >= 0) {
        indiciesOfValuesInStorageToMergeWithResponse.end = endIndex;
        break;
      }
    }

    // Then assuming that we were able to get valid indices above, we slice the storage values using them
    if (
      indiciesOfValuesInStorageToMergeWithResponse.start !== undefined &&
      indiciesOfValuesInStorageToMergeWithResponse.end !== undefined &&
      indiciesOfValuesInStorageToMergeWithResponse.start >= 0 &&
      indiciesOfValuesInStorageToMergeWithResponse.end >= 0
    ) {
      timeValuesFromStorageNoOverlapWithResponse = timeValuesFromStorage.slice(
        indiciesOfValuesInStorageToMergeWithResponse.start,
        indiciesOfValuesInStorageToMergeWithResponse.end + 1
      );
      existingValueFrameNewValuesRemoved = valuesFromStorage.slice(
        indiciesOfValuesInStorageToMergeWithResponse.start,
        indiciesOfValuesInStorageToMergeWithResponse.end + 1
      );
    } else {
      if (DEBUG) {
        console.warn('Not enough indices, unable to merge frames');
      }
    }

    return { time: timeValuesFromStorageNoOverlapWithResponse, values: existingValueFrameNewValuesRemoved };
  }

  /**
   * A helper function that returns an index of a frame if it's not too old and we don't want to evict it, or if it's already contained in the response
   * @param timeValuesFromResponse
   * @param timeValuesFromStorage
   * @param i
   * @param originalRange
   * @param intervalInSeconds
   * @param valuesFromStorage
   * @param evict
   * @private
   */
  private static getValidFrameIndex(
    timeValuesFromResponse: number[],
    timeValuesFromStorage: number[],
    i: number,
    originalRange: { end: number; start: number },
    intervalInSeconds: number,
    valuesFromStorage: number[],
    evict: boolean
  ): false | number {
    //@todo performance
    const doesResponseNotContainStoredTimeValue = timeValuesFromResponse.indexOf(timeValuesFromStorage[i]) === -1;

    // Remove values from before new start
    // Note this acts as the only eviction strategy so far, we only store frames that exist after the start of the current query, minus the interval time
    const isFrameOlderThenQueryStart =
      timeValuesFromStorage[i] <= originalRange.start - intervalInSeconds * 1000 && evict;

    if (isFrameOlderThenQueryStart && DEBUG) {
      console.log(
        'Frame is older then query, evicting',
        timeValuesFromStorage[i] - (originalRange.start - intervalInSeconds * 1000),
        timeValuesFromStorage[i],
        originalRange.start,
        intervalInSeconds,
        i
      );
    }

    const isThisAFrameWeWantToCombineWithCurrentResult =
      doesResponseNotContainStoredTimeValue && !isFrameOlderThenQueryStart;
    // Only add timeframes from the old data to the new data, if they aren't already contained in the new data
    if (isThisAFrameWeWantToCombineWithCurrentResult) {
      if (valuesFromStorage[i] !== undefined && timeValuesFromStorage[i] !== undefined) {
        return i;
      }
    }
    return false;
  }

  /**
   * Sets values for a given query index and series index
   * @param queryIndex
   * @param seriesIndex
   * @param values
   */
  private setStorageFieldsValues = (queryIndex: string, seriesIndex: string, values: number[]) => {
    if (queryIndex in this.storage) {
      this.storage[queryIndex][seriesIndex] = values;
    } else {
      this.throwError(new Error('Invalid query index'));
    }
  };

  /**
   * Sets the time values for a given query index
   * @param queryIndex
   * @param values
   */
  private setStorageTimeFields = (queryIndex: string, values: number[]) => {
    this.storage[queryIndex] = {
      ...this.storage[queryIndex],
      __time__: values,
    };
  };

  /**
   * gets all fields for a query index
   * @param queryIndex
   */
  private getStorageFieldsForQuery = (queryIndex: string): Record<string, number[]> | null => {
    if (queryIndex in this.storage) {
      return this.storage[queryIndex];
    }

    return null;
  };

  /**
   * Generates the storage index by concatenating the interpolated expression string with step string
   * @param target
   * @param request
   */
  private createStorageIndexFromRequestTarget = (
    target: PromQuery,
    request: DataQueryRequest<PromQuery>
  ): string | undefined => {
    if (!target) {
      console.error('Request target is required to build storage index');
      return;
    }

    if (!target?.expr) {
      console.error('Request expression is required to build storage index');
      return;
    }

    // If the query (target) doesn't explicitly have an interval defined it's gonna use the one that's available on the request object.
    // @todo is the above true, or is there a standard way tro
    const intervalString = target?.interval ? target?.interval : request.interval;

    if (!intervalString) {
      this.throwError(new Error('Request interval is required to build storage index'));
    }

    const expressionInterpolated = this.datasource.interpolateString(target?.expr);

    return expressionInterpolated + '__' + intervalString;
  };

  /**
   * This is mostly used for debugging purposes right now, maybe should get cleaned up
   */
  getStorage = () => {
    return this.storage;
  };

  /**
   * Back-fill dataframe missing values via applyNullInsertThreshold function
   * @param data
   * @private
   */
  private preProcessDataFrames(
    data: DataFrame[],
    intervalSeconds: number,
    requestRange: TimeRange,
    rangeOfQueryBeforeModification?: { end: number; start: number }
  ) {
    if (!data?.length || !data[0].fields[0]) {
      return;
    }
    const intervalMs = intervalSeconds * 1000;

    const times = data[0].fields[0].values.toArray();
    const firstTime = times[0];
    const lastTime = times[times.length - 1];
    let longestLength = Math.ceil(lastTime - firstTime / (intervalSeconds * 1000));

    // Get the times of the first series
    const firstFrameTimeValues = data[0].fields[0].values?.toArray();

    // Get first time value
    const requestMin = requestRange.from.valueOf();

    let firstResponseTime: number = firstFrameTimeValues[0];

    const numberOfSteps = Math.ceil((firstResponseTime - requestMin) / intervalMs);

    let firstRequestTimeAlignedWithResponse = firstFrameTimeValues[0] - numberOfSteps * intervalMs;

    // Get last time value
    let max: number = firstFrameTimeValues[firstFrameTimeValues.length - 1];
    let min;

    if (rangeOfQueryBeforeModification === undefined) {
      // If this is the first time we're seeing this particular request, we might be missing data at the start of the query window, since prometheus doesn't return null values in the response,
      // we're going to need to backfill the entire duration of the request window, and not the response
      min =
        firstRequestTimeAlignedWithResponse < firstResponseTime
          ? firstRequestTimeAlignedWithResponse
          : firstResponseTime;
    } else {
      min = firstFrameTimeValues[0];
    }

    // Walk through the data frames and get the first and last values of the time array
    for (let i = 0; i < data.length; i++) {
      const thisFrameTimeValues = data[i].fields[0]?.values?.toArray();
      const firstFrameValue = thisFrameTimeValues[0];
      const lastFrameValue = thisFrameTimeValues[thisFrameTimeValues.length - 1];

      if (min > firstFrameValue) {
        min = firstFrameValue;
      }

      if (max < lastFrameValue) {
        max = lastFrameValue;
      }
    }

    // Square up the frames to match the longest series, or the desired query window
    for (let i = 0; i < data.length; i++) {
      if (longestLength && longestLength !== data[i].length) {
        data[i] = applyNullInsertThreshold({
          frame: data[i],
          refFieldName: 'Time',
          refFieldPseudoMax: max,
          refFieldPseudoMin: min,
        });
      }
    }
  }

  /**
   * Mutate the values on the dataFrame, and set the time value in storage for the given index, remember each query shares one time array for all series
   * @param timeFieldsToSet
   * @param dataFramesForThisQuery
   * @private
   */
  private setTimeFields(timeFieldsToSet: { index?: string; values?: number[] }, dataFramesForThisQuery: DataFrame[]) {
    const values = new ArrayVector(timeFieldsToSet.values);
    // Save the values in storage
    this.setStorageTimeFields(timeFieldsToSet.index ?? '', timeFieldsToSet?.values ?? []);

    // Get all time series
    dataFramesForThisQuery.forEach((dataFrame) => {
      // Filter out the value fields, this is a loop but there's only one field
      const responseTimeFields = dataFrame.fields?.filter((field) => field.name === TIME_SERIES_TIME_FIELD_NAME);
      responseTimeFields.forEach((timeField) => {
        // Overwrite the existing dataframe time fields with the values calculated in the previous loop
        timeField.values = values;
      });
    });
  }

  /**
   * This function takes a field value, and checks to see if the storage has any hits for this field and query string
   * If not, it adds it to storage
   * If it does, we dedupe any overlapping frames, pulling any new ones from the request,
   * and save the values in storage and on the dataframe
   * This means as we walk through the dataframes coming in from the request, the length of each field within that request will get longer one by one until the end of the loop when they are all the new size, which should match the number of intervals in the current request window
   *
   * @param valueField
   * @param storedSeriesFromStorage
   * @param responseTimeField
   * @param responseQueryExpressionAndStepString
   * @param originalRange
   * @param intervalSeconds
   * @private
   */
  private setValueFieldsGetTimeValues(
    valueField: Field,
    storedSeriesFromStorage: Record<string, number[]> | null,
    responseTimeField: Field,
    responseQueryExpressionAndStepString: string,
    originalRange: { end: number; start: number } | undefined,
    intervalSeconds: number
  ) {
    let timeValuesStorage: number[] = [];
    const responseFrameValues: number[] | undefined = valueField?.values?.toArray();

    // Generate a unique name for this dataframe using the values
    const seriesLabelsIndexString = IncrementalStorage.valueFieldToLabelsString(valueField);

    // If we don't have storage, dataframes, or any values for this label, we haven't added this query to storage before
    const thisQueryHasNeverBeenDoneBefore =
      !this.storage || !storedSeriesFromStorage || !storedSeriesFromStorage[seriesLabelsIndexString];

    const thisQueryHasBeenDoneBefore = !thisQueryHasNeverBeenDoneBefore;

    const timeValuesFromResponse: number[] = responseTimeField?.values?.toArray() ?? [];

    // Store the response if it's new
    if (thisQueryHasNeverBeenDoneBefore && seriesLabelsIndexString && responseFrameValues?.length) {
      this.setStorageTimeFields(responseQueryExpressionAndStepString, timeValuesFromResponse);
      this.setStorageFieldsValues(responseQueryExpressionAndStepString, seriesLabelsIndexString, responseFrameValues);
    } else if (thisQueryHasBeenDoneBefore && seriesLabelsIndexString && originalRange) {
      // If the labels are the same as saved, append any new values, making sure that any additional data is taken from the newest response

      //@todo
      const timeValuesFromStorage = storedSeriesFromStorage['__time__'];
      const valuesFromStorage = storedSeriesFromStorage[seriesLabelsIndexString];

      // These values could be undefined or null, so we have a bit of long conditional, but we're just checking that we have values in storage and the response
      if (responseFrameValues?.length > 0 && valuesFromStorage.length > 0 && timeValuesFromResponse.length > 0) {
        const dedupedFrames = IncrementalStorage.removeFramesFromStorageThatExistInRequest(
          timeValuesFromStorage,
          timeValuesFromResponse,
          originalRange,
          valuesFromStorage,
          intervalSeconds
        );

        const allTimeValuesMerged = dedupedFrames.time.concat(timeValuesFromResponse);

        const allValueFramesMerged = dedupedFrames.values.concat(responseFrameValues);

        // This is a reference to the original dataframes passed in, so we're mutating the original dataframe here!
        valueField.values = new ArrayVector(allValueFramesMerged);

        // If we set the time values here we'll screw up the rest of the loop, we should be checking to see if each series has the same time steps, or we need to clear the cache
        // So just set the values
        this.setStorageFieldsValues(
          responseQueryExpressionAndStepString,
          seriesLabelsIndexString,
          allValueFramesMerged
        );

        // And return the calculated time values
        timeValuesStorage = allTimeValuesMerged;
      } else {
        if (DEBUG) {
          console.warn('cannot merge values!');
        }
      }
    }
    return timeValuesStorage;
  }

  /**
   * Note, a known problem for this is query "drift" when users are editing in a dashboard panel,
   * each change to the query expression or interval will create a new object in storage,
   * and the only cache eviction is managed when we have something in storage that matches the response.
   * i.e. if you keep changing the query expression and interval, those old queries will remain in storage indefinitely.
   * Until that is solved this might best belong in dashboard contexts only, and not explore?
   * @todo
   *
   * @param request
   * @param dataFrames
   * @param originalRange
   */
  appendQueryResultToDataFrameStorage = (
    request: DataQueryRequest<PromQuery | LokiQuery>,
    dataFrames: DataQueryResponse,
    originalRange?: { end: number; start: number }
  ): DataQueryResponse => {
    const data: DataFrame[] = dataFrames.data;

    const intervalSeconds = rangeUtil.intervalToSeconds(request.interval);
    // Frames aren't always the same length, since this storage assumes a single time array for all values, that means we need to back-fill missing values
    this.preProcessDataFrames(data, intervalSeconds, request.range, originalRange);

    // Iterate through all of the queries
    request.targets.forEach((target) => {
      // Filter out the series that aren't for this query
      const dataFramesForThisQuery = data.filter((response) => response.refId === target.refId);

      let timeFieldsToSet: { index?: string; values?: number[] } = {};
      dataFramesForThisQuery.forEach((responseFrame) => {
        // Concatenate query expression and step to use as index for all series returned by query
        // Multiple queries with same expression and step will share the same cache, I don't think that's a problem?
        const responseQueryExpressionAndStepString = this.createStorageIndexFromRequestTarget(target, request);

        // For each query response get the time and the values
        const responseTimeFields = responseFrame.fields?.filter((field) => field.name === TIME_SERIES_TIME_FIELD_NAME);

        const responseTimeField = responseTimeFields[0];

        // We're consuming these dataFrames after the transform which will remove some duplicate time values that is sent in the raw response from prometheus
        const responseValueFields = responseFrame.fields?.filter((field) => field.name !== TIME_SERIES_TIME_FIELD_NAME);

        // If we aren't able to create the query expression string to be used as the index, we should stop now
        if (!responseQueryExpressionAndStepString) {
          this.throwError(new Error('Unable to generate storage index'));
          return;
        }

        const storedSeriesFromStorage = this.getStorageFieldsForQuery(responseQueryExpressionAndStepString);

        // We're about to prime the storage, so let's prime the main object
        if (!(responseQueryExpressionAndStepString in this.storage)) {
          this.setStorageTimeFields(responseQueryExpressionAndStepString, responseTimeField?.values?.toArray());
        }

        let timeValuesStorage: number[] = [];
        responseValueFields.forEach((valueField) => {
          timeValuesStorage = this.setValueFieldsGetTimeValues(
            valueField,
            storedSeriesFromStorage,
            responseTimeField,
            responseQueryExpressionAndStepString,
            originalRange,
            intervalSeconds
          );
        });

        // If we have time values we want to save as well, let's save them until after this loop
        if (timeValuesStorage.length > 0 && responseTimeField?.values && !timeFieldsToSet.index) {
          timeFieldsToSet = { index: responseQueryExpressionAndStepString, values: timeValuesStorage };
        }
      });

      // Now that we're done setting values, we want to set the times in storage and in the dataframe, remember dataFramesForThisQuery is
      if (timeFieldsToSet && timeFieldsToSet.index && timeFieldsToSet.values) {
        this.setTimeFields(timeFieldsToSet, dataFramesForThisQuery);
      }
    });

    return dataFrames;
  };

  /**
   * The name says it all! This function will change the incoming request duration if we've already got some of the data in storage
   *
   * @param request
   */
  modifyRequestDurationsIfStorageOverlapsRequest(request: DataQueryRequest<PromQuery | LokiQuery>): {
    request: DataQueryRequest<PromQuery>;
    originalRange?: { end: number; start: number };
  } {
    const requestFrom = request.range.from;
    const requestTo = request.range.to;

    let canCache: Boolean[] = [];
    let neededDurations: Array<{ end: number; start: number }> = [];

    const interval = rangeUtil.intervalToSeconds(request.interval);

    for (let i = 0; i < request.targets.length; i++) {
      const target = request.targets[i];

      const storageIndex: string | undefined = this.createStorageIndexFromRequestTarget(target, request);

      if (!storageIndex) {
        if (DEBUG) {
          console.warn('No Cache key was generated, targets cannot be streamed');
        }
        canCache.push(false);
        break;
      }

      // Exclude instant queries, hidden queries, and exemplar queries, as they are not currently applicable for incremental querying.
      // exemplars could work, but they're not step/interval-aligned so the current algorithm of merging frames from storage with the response won't work
      // Would simply backfilling these values work? Or do we need to store the time frames for each exemplar? We're going to address this in another PR as there's enough going on already with this.
      const prometheusQueryIsInvalid =
        (target?.range !== true && 'format' in target && target?.format !== 'time_series') ||
        target.hide ||
        ('exemplar' in target && target.exemplar);
      if (prometheusQueryIsInvalid) {
        if (DEBUG) {
          console.log('target invalid for incremental querying', target);
        }
        break;
      }

      const previousResultForThisQuery = this.getStorageFieldsForQuery(storageIndex);

      if (previousResultForThisQuery) {
        const timeValuesFromStorage = previousResultForThisQuery[STORAGE_TIME_INDEX];

        // Assume that the added fields are contiguous (they should already be back-filled by now), and every series always has the most recent samples
        if (timeValuesFromStorage) {
          const cacheFrom = timeValuesFromStorage[0];
          const cacheTo = timeValuesFromStorage[timeValuesFromStorage.length - 1];

          // There is more logic we can do here to save some more bytes, for example, if the query window is entirely contained in the stored data, or potentially if the query starts before the stored data,
          // but ends during the duration, then we could then only query the values we need at the beginning, instead of giving up and re-querying everything.

          // The expected case when the query start is contained in storage
          if (
            requestFrom.valueOf() >= cacheFrom &&
            requestFrom.valueOf() <= cacheTo &&
            requestTo.valueOf() >= cacheTo
          ) {
            canCache.push(true);

            const range = alignRange(
              cacheTo,
              requestTo.valueOf(),
              interval,
              this.timeSrv.timeRange().to.utcOffset() * 60
            );
            neededDurations.push({ start: range.start, end: range.end });
          } else {
            if (DEBUG) {
              console.log('invalid duration! Deleting storageIndex', storageIndex);
              console.log('storage before purge', this.storage);
            }
            delete this.storage[storageIndex];
          }
        }
      } else {
        canCache.push(false);
      }
    }

    if (
      canCache.length &&
      neededDurations.length &&
      canCache.every((val) => val) &&
      neededDurations.every(
        // assert every start and end values are the same from every request
        (val) => val && val.start === neededDurations[0].start && val.end === neededDurations[0].end
      )
    ) {
      const originalRange = cloneDeep(request.range);

      const originalRangeAligned = alignRange(
        originalRange.from.valueOf(),
        originalRange.to.valueOf(),
        interval,
        this.timeSrv.timeRange().to.utcOffset() * 60
      );

      const newRange = alignRange(
        dateTime(neededDurations[0].start - INCREMENTAL_QUERY_OVERLAP_DURATION_MS).valueOf(),
        dateTime(neededDurations[0].end).valueOf(),
        interval,
        this.timeSrv.timeRange().to.utcOffset() * 60
      );

      const rawTimeRange = {
        from: newRange.start,
        to: newRange.end,
      };

      const newTimeRange: TimeRange = {
        from: dateTime(rawTimeRange.from),
        to: dateTime(rawTimeRange.to),
        raw: {
          from: dateTime(newRange.start),
          to: dateTime(newRange.end),
        },
      };

      if (DEBUG) {
        console.warn('QUERY IS CONTAINED BY CACHE, MODIFYING REQUEST', this.storage);
      }

      // calculate new from/tos
      return { request: { ...request, range: newTimeRange }, originalRange: originalRangeAligned };
    } else {
      if (DEBUG) {
        console.warn('QUERY NOT CONTAINED BY CACHE, NOT MODIFYING REQUEST', request);
      }
    }

    return { request: request };
  }
}
