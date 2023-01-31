import {
  DataFrame,
  DataFrameDTO,
  DataQueryRequest,
  DataQueryResponse,
  dateTime,
  Field,
  FieldDTO,
  rangeUtil,
  TIME_SERIES_TIME_FIELD_NAME,
  TimeRange,
} from '@grafana/data/src';
import {PromQuery} from '../types';
import {cloneDeep} from 'lodash';
import {alignRange} from '../datasource';
import {getTimeSrv, TimeSrv} from '../../../../features/dashboard/services/TimeSrv';
import {applyNullInsertThreshold} from '@grafana/ui/src/components/GraphNG/nullInsertThreshold';

// Decreasing the duration of the overlap provides even further performance improvements, however prometheus data over the last 10 minutes is in flux, and could be out of order from the past 2 hours
// Get link to prometheus doc for the above comment
const PROMETHEUS_INCREMENTAL_QUERY_OVERLAP_DURATION_MS = 60 * 10 * 1000;
const PROMETHEUS_STORAGE_TIME_INDEX = '__time__';
const PROMETHEUS_STORAGE_EXEMPLAR_INDEX = 'exemplar';
const DEBUG = false;

// Another issue: if the query window starts at a time when there is no results from the database, we'll always fail the cache check and pull fresh data, even though the cache has everything available
// Also the cache can def get really big for big queries, need to look into if we want to find a way to limit the size of requests we add to the cache?
export class PrometheusIncrementalStorage {
  private storage: Record<string, Record<string, number[]>>;

  constructor(private readonly timeSrv: TimeSrv = getTimeSrv()) {
    this.storage = {};
  }

  throwError = (error: Error) => {
    if (DEBUG) {
      console.error('Fatal storage error:', error);
      console.log('Storage state', this.storage);
    }
    this.storage = {};

    throw error;
  };

  /**
   * Get index for flat storage
   * @param valueField
   */
  private static valueFrameToLabelsString = (valueField: FieldDTO | Field): string => {
    let keyValues: Array<{ key: string; value: any }> = [];

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
      // @leon throw an error when there are more than one series without labels
    }

    // @leon better
    return JSON.stringify(keyValues);
  };

  // @todo gate
  private setStorageFieldsValues = (queryIndex: string, seriesIndex: string, values: number[]) => {
    if (queryIndex in this.storage) {
      this.storage[queryIndex][seriesIndex] = values;
    } else {
      this.throwError(new Error('Invalid storage index'));
    }
  };

  private setStorageTimeFields = (queryIndex: string, values: number[]) => {
    const valuesToSet = {
      ...this.storage[queryIndex],
      __time__: values,
    };
    this.storage[queryIndex] = valuesToSet;
  };

  private getStorageTimeFields = (queryIndex: string) => {
    if (queryIndex in this.storage) {
      return this.storage[queryIndex]['__time__'];
    }

    return null;
  };

  private getStorageValueField = (queryIndex: string, seriesIndex: string) => {
    if (queryIndex in this.storage && seriesIndex in this.storage[queryIndex]) {
      return this.storage[queryIndex][seriesIndex];
    }

    return null;
  };

  private getStorageFieldsForQuery = (queryIndex: string): Record<string, number[]> | null => {
    if (queryIndex in this.storage) {
      return this.storage[queryIndex];
    }

    return null;
  };

  /**
   * @todo need to interpolate variables or we'll get bugs
   * @param target
   * @param request
   */
  private createPrometheusStorageIndexFromRequestTarget = (
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

    // target.expr =

    // If the query (target) doesn't explicitly have an interval defined it's gonna use the one that's available on the request object.
    // @todo is the above true?
    const intervalString = target?.interval ?? request.interval;

    if (!intervalString) {
      this.throwError(new Error('Request interval is required to build storage index'));
    }

    return target?.expr + '__' + intervalString;
  };

  removeFramesFromStorageThatExistInRequest(
    existingTimeFrames: number[],
    responseTimeFieldValues: number[],
    originalRange: { end: number, start: number },
    existingValueFrames: number[],
    intervalInSeconds: number
  ) {
    let framesFromStorageRelevantToCurrentQuery: number[] = [];
    let existingValueFrameNewValuesRemoved: number[] = [];

    for (let i = 0; i < existingTimeFrames?.length; i++) {
      const doesResponseNotContainFrameTimeValue = responseTimeFieldValues.indexOf(existingTimeFrames[i]) === -1;

      // Remove values from before new start
      // Note this acts as the only eviction strategy so far, we only store frames that exist after the start of the current query, minus twice the overlap as a buffer as we don't want to
      // need to add one stime step of buffer @todo
      const isFrameOlderThenQueryStart = existingTimeFrames[i] <= originalRange.start - (intervalInSeconds * 1000)

      if (isFrameOlderThenQueryStart && DEBUG) {
        debugger;

        console.log('Frame is older then query, evicting', existingTimeFrames[i] - originalRange.start, existingTimeFrames[i], originalRange.start);
      }

      const isThisAFrameWeWantToCombineWithCurrentResult = doesResponseNotContainFrameTimeValue && !isFrameOlderThenQueryStart;
      // Only add timeframes from the old data to the new data, if they aren't already contained in the new data
      if (isThisAFrameWeWantToCombineWithCurrentResult) {
        if (existingValueFrames[i] !== undefined && existingTimeFrames[i] !== undefined) {
          framesFromStorageRelevantToCurrentQuery.push(existingTimeFrames[i]);
          existingValueFrameNewValuesRemoved.push(existingValueFrames[i]);
        } else {
          if (DEBUG) {
            console.warn('empty value frame?', i, existingValueFrames);
          }
        }
      }
    }

    return { time: framesFromStorageRelevantToCurrentQuery, values: existingValueFrameNewValuesRemoved };
  }

  /**
   * Back-fill dataframe missing values via applyNullInsertThreshold function
   * @param data
   * @private
   */
  private preProcessDataFrames(data: DataFrame[] | DataFrameDTO[]) {
    if (!data?.length) {
      if (DEBUG) {
        console.error('Dataframe has no fields!');
      }
      return;
    }
    let longestLength = data[0]?.length ?? 0;

    const firstFrameTimeValues = data[0].fields[0].values?.toArray();

    // Get first time value
    let min = firstFrameTimeValues[0];

    // Get last time value
    let max = firstFrameTimeValues[firstFrameTimeValues.length - 1];

    // Walk through the data frames and get the first and last values of the time array
    //@todo doesn't transform v2 nest the dataframes for heatmaps? is this going to get the wrong min/max values for nested frames?
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

      if (data[i].length > longestLength) {
        longestLength = data[i].length;
      }
    }

    for (let i = 0; i < data.length; i++) {
      if (longestLength && longestLength !== data[i].length) {
        data[i] = applyNullInsertThreshold({
          frame: data[i] as DataFrame,
          refFieldName: 'Time',
          refFieldPseudoMax: max,
          refFieldPseudoMin: min,
        });
      }
    }
  }

  /**
   * Note, a known problem for this is query "drift" when users are editing in a dashboard panel,
   * each change to the query or interval will create a new object in storage, which currently only get cleaned up as new responses come in
   * Since in a dashboard each panel
   *
   * @param request
   * @param dataFrames
   * @param originalRange
   */
  appendQueryResultToDataFrameStorage = (
    request: DataQueryRequest<PromQuery>,
    dataFrames: DataQueryResponse,
    originalRange?: { end: number, start: number }
  ): DataQueryResponse => {
    if (DEBUG) {
      // console.warn('request', JSON.stringify(request));
      // console.warn('dataFrames', JSON.stringify(dataFrames));
      // console.warn('originalRange', JSON.stringify(originalRange));
      // console.warn('TIMESRV', JSON.stringify(this.timeSrv.timeRange()))
    }

    const data: DataFrame[] | DataFrameDTO[] = dataFrames.data;

    // Frames aren't always the same length, since this storage assumes a single time array for all values, that means we need to back-fill missing values
    this.preProcessDataFrames(data);

    // Iterate through all of the queries
    request.targets.forEach((target) => {
      // Filter out the series that aren't for this query
      const timeSeriesForThisQuery = data.filter((response) => response.refId === target.refId);
      timeSeriesForThisQuery.forEach((response) => {
        if (response?.meta?.custom?.resultType !== 'matrix') {
          return;
        }

        // Concatenate query expression and step to use as index for all series returned by query
        // Multiple queries with same expression and step will share the same cache, I don't think that's a problem?
        const responseQueryExpressionAndStepString = this.createPrometheusStorageIndexFromRequestTarget(
          target,
          request
        );

        // For each query response get the time and the values
        const responseTimeFields = response.fields?.filter((field) => field.name === TIME_SERIES_TIME_FIELD_NAME);

        const responseTimeField = responseTimeFields[0];

        // We're consuming these dataFrames after the transform which will remove some duplicate time values that is sent in the raw response from prometheus
        const responseValueFields = response.fields?.filter((field) => field.name !== TIME_SERIES_TIME_FIELD_NAME);

        // If we aren't able to create the query expression string to be used as the index, we should stop now
        if (!responseQueryExpressionAndStepString) {
          this.throwError(new Error('Unable to generate storage index'));
          return;
        }

        const previousDataFrames = this.getStorageFieldsForQuery(responseQueryExpressionAndStepString);

        // We're about to prime the storage, so let's prime the main object
        if (!(responseQueryExpressionAndStepString in this.storage)) {
          this.setStorageTimeFields(responseQueryExpressionAndStepString, responseTimeField?.values?.toArray());
        }

        let timeValuesStorage: number[] = [];
        responseValueFields.forEach((valueField) => {
          const responseFrameValues: number[] | undefined = valueField?.values?.toArray();

          // Generate a unique name for this dataframe using the values
          const seriesLabelsIndexString = PrometheusIncrementalStorage.valueFrameToLabelsString(valueField);

          // If we don't have storage, dataframes, or any values for this label, we haven't added this query to storage before
          const thisQueryHasNeverBeenDoneBefore =
            !this.storage || !previousDataFrames || !previousDataFrames[seriesLabelsIndexString];

          const thisQueryHasBeenDoneBefore = !thisQueryHasNeverBeenDoneBefore;

          const responseTimeFieldValues: number[] = responseTimeField?.values?.toArray() ?? [];

          // Store the response if it's new
          if (thisQueryHasNeverBeenDoneBefore && seriesLabelsIndexString && responseFrameValues?.length) {
            if (responseFrameValues.length !== responseTimeFieldValues.length) {
              if (DEBUG) {
                console.warn('Initial values not same length?', responseFrameValues, responseTimeFieldValues);
                debugger;
              }
            }

            this.setStorageTimeFields(responseQueryExpressionAndStepString, responseTimeFieldValues);
            this.setStorageFieldsValues(
              responseQueryExpressionAndStepString,
              seriesLabelsIndexString,
              responseFrameValues
            );
          } else if (thisQueryHasBeenDoneBefore && seriesLabelsIndexString && originalRange) {
            // If the labels are the same as saved, append any new values, making sure that any additional data is taken from the newest response

            const existingTimeFrames = previousDataFrames['__time__'];
            const existingValueFrames = previousDataFrames[seriesLabelsIndexString];

            // These values could be undefined or null, so we have a bit of long conditional, but we're just checking that we have values in storage and the response
            if (
              responseFrameValues &&
              responseFrameValues?.length > 0 &&
              existingValueFrames &&
              existingValueFrames.length > 0 &&
              existingTimeFrames &&
              responseTimeFieldValues.length > 0
            ) {
              const intervalSeconds = rangeUtil.intervalToSeconds(request.interval);
              // Filter out values in storage from before query range
              const dedupedFrames = this.removeFramesFromStorageThatExistInRequest(
                existingTimeFrames,
                responseTimeFieldValues,
                originalRange,
                existingValueFrames,
                intervalSeconds
              );


              const allTimeValuesMerged = [...dedupedFrames.time, ...responseTimeFieldValues];

              const allValueFramesMerged = [...dedupedFrames.values, ...responseFrameValues];

              // This is a reference to the original dataframes passed in, so we're mutating the original dataframe here!
              valueField!.values!.buffer = allValueFramesMerged;

              // If we set the time values here we'll screw up the rest of the loop, we should be checking to see if each series has the same time steps, or we need to clear the cache
              timeValuesStorage = allTimeValuesMerged;

              this.setStorageTimeFields(responseQueryExpressionAndStepString, allTimeValuesMerged);
              this.setStorageFieldsValues(
                responseQueryExpressionAndStepString,
                seriesLabelsIndexString,
                allValueFramesMerged
              );
            } else {
              if (DEBUG) {
                console.warn('cannot merge values!');
              }
            }
          }
        });

        // If we changed the time steps, let's mutate the dataframe
        if (timeValuesStorage.length > 0 && responseTimeField?.values) {
          responseTimeField.values.buffer = timeValuesStorage;
          this.setStorageTimeFields(responseQueryExpressionAndStepString, timeValuesStorage);
        }
      });
    });

    return dataFrames;
  };

  /**
   * The name says it all! This function will change the incoming request duration if we've already got some of the data in storage
   *
   * @param request
   */
  modifyRequestDurationsIfStorageOverlapsRequest(request: DataQueryRequest<PromQuery>): {
    request: DataQueryRequest<PromQuery>;
    originalRange?: { end: number, start: number };
  } {
    const requestFrom = request.range.from;
    const requestTo = request.range.to;

    let canCache: Boolean[] = [];
    let neededDurations: Array<{ end: number; start: number }> = [];

    const interval = rangeUtil.intervalToSeconds(request.interval);

    for (let i = 0; i < request.targets.length; i++) {
      const target = request.targets[i];

      const storageIndex: string | undefined = this.createPrometheusStorageIndexFromRequestTarget(target, request);

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
      if (target?.range !== true || target.hide || target.exemplar) {
        if (DEBUG) {
          console.log('target invalid for incremental querying', target);
        }
        break;
      }

      const previousResultForThisQuery = this.getStorageFieldsForQuery(storageIndex);

      if (previousResultForThisQuery) {
        const timeValuesFromStorage = previousResultForThisQuery[PROMETHEUS_STORAGE_TIME_INDEX];

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
      // @todo align this?
      const originalRange = cloneDeep(request.range);

      const originalRangeAligned = alignRange(
        originalRange.from.valueOf(),
        originalRange.to.valueOf(),
        interval,
        this.timeSrv.timeRange().to.utcOffset() * 60
      );

      const rawTimeRange = {
        from: dateTime(neededDurations[0].start - PROMETHEUS_INCREMENTAL_QUERY_OVERLAP_DURATION_MS),
        to: dateTime(neededDurations[0].end),
      };

      const timeRange: TimeRange = {
        ...rawTimeRange,
        raw: rawTimeRange,
      };

      if (DEBUG) {
        console.warn('QUERY IS CONTAINED BY CACHE, MODIFYING REQUEST', this.storage);
      }

      // calculate new from/tos
      return { request: { ...request, range: timeRange }, originalRange: originalRangeAligned };
    } else {
      if (DEBUG) {
        console.warn('QUERY NOT CONTAINED BY CACHE, NOT MODIFYING REQUEST', request);
      }
    }

    return { request: request };
  }
}
