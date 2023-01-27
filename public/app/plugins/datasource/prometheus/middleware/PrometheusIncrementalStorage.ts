import {
  DataFrame,
  DataFrameDTO,
  DataQueryRequest,
  DataQueryResponse,
  DataQueryResponseData,
  dateTime,
  Field,
  FieldDTO,
  rangeUtil,
  TIME_SERIES_TIME_FIELD_NAME,
  TimeRange,
} from '@grafana/data/src';
import { PromQuery } from '../types';
import { cloneDeep } from 'lodash';
import { alignRange } from '../datasource';
import { getTimeSrv, TimeSrv } from '../../../../features/dashboard/services/TimeSrv';
import {applyNullInsertThreshold} from "@grafana/ui/src/components/GraphNG/nullInsertThreshold";

// Decreasing the duration of the overlap provides even further performance improvements, however prometheus data over the last 10 minutes is in flux, and could be out of order from the past 2 hours
// Get link to prometheus doc for the above comment
const PROMETHEUS_INCREMENTAL_QUERY_OVERLAP_DURATION_MS = 60 * 10 * 1000;
const PROMETHEUS_STORAGE_TIME_INDEX = '__time__';
const PROMETHEUS_STORAGE_EXEMPLAR_INDEX = 'exemplar';
const DEBUG = true;

// Another issue: if the query window starts at a time when there is no results from the database, we'll always fail the cache check and pull fresh data, even though the cache has everything available
// Also the cache can def get really big for big queries, need to look into if we want to find a way to limit the size of requests we add to the cache?
export class PrometheusIncrementalStorage {
  private readonly storage: Record<string, Record<string, number[]>>;

  constructor(private readonly timeSrv: TimeSrv = getTimeSrv()) {
    this.storage = {};
  }

  setStorageFieldsValues = (queryIndex: string, seriesIndex: string, values: number[]) => {
    // @todo gate
    this.storage[queryIndex][seriesIndex] = values;
  };

  setStorageTimeFields = (queryIndex: string, values: number[]) => {
    // @todo gate
    this.storage[queryIndex] = {
      __time__: values,
      ...this.storage[queryIndex],
    };
  };

  // @todo
  getStorageTimeFields = (queryIndex) => {
    return this.storage[queryIndex]['__time__'];
  };

  /**
   * @todo need to interpolate variables or we'll get bugs
   * @param target
   * @param request
   */
  createPrometheusStorageIndexFromRequestTarget = (
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
    // @leon is the above true?
    const intervalString = target?.interval ?? request.interval;

    if (!intervalString) {
      console.error('Request interval is required to build storage index');
      return;
    }

    return target?.expr + '__' + intervalString;
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

  /**
   * @leon refactor out
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
    originalRange?: TimeRange
  ): DataQueryResponseData => {
    const data: DataFrame[] | DataFrameDTO[] = dataFrames.data;
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

        if (
          !responseTimeFields.every(
            (field) => field?.values?.length && field?.values?.length === responseTimeField?.values?.length
          )
        ) {
          console.warn('Not every series in this query has the same number of samples! Purging cache');
          return;
        }

        // We're consuming these dataFrames after the transform which will remove some duplicate time values that is sent in the raw response from prometheus
        const responseValueFields = response.fields?.filter((field) => field.name !== TIME_SERIES_TIME_FIELD_NAME);

        if (
          !responseValueFields.every(
            (field) => field?.values?.length && field?.values?.length === responseValueFields[0]?.values?.length
          )
        ) {
          console.warn('Not every series in this query has the same number of samples! Purging cache');
          return;
        }

        // If we aren't able to create the query expression string to be used as the index, we should stop now
        if (!responseQueryExpressionAndStepString) {
          console.warn('unable to generate flat index for !');
          return;
        }

        const previousDataFrames =
          responseQueryExpressionAndStepString in this.storage
            ? this.storage[responseQueryExpressionAndStepString]
            : false;

        // We're about to prime the storage, so let's prime the main object
        if (!(responseQueryExpressionAndStepString in this.storage)) {
          this.setStorageTimeFields(responseQueryExpressionAndStepString, responseTimeField?.values?.toArray());
        }

        let timeValuesStorage: string | any[] = [];
        responseValueFields.forEach((valueField) => {
          const responseFrameValues: number[] | undefined = valueField?.values?.toArray();
          // Generate a unique name for this dataframe using the values

          const seriesLabelsIndexString = PrometheusIncrementalStorage.valueFrameToLabelsString(valueField);

          const thisQueryHasNeverBeenDoneBefore =
            !this.storage || !previousDataFrames || !previousDataFrames[seriesLabelsIndexString];
          const thisQueryHasBeenDoneBefore = !thisQueryHasNeverBeenDoneBefore;

          //@leon types
          const responseTimeFieldValues: number[] = responseTimeField?.values?.toArray() ?? [];

          // Store the response if it'.s new
          if (thisQueryHasNeverBeenDoneBefore && seriesLabelsIndexString && responseFrameValues?.length) {
            if (responseFrameValues.length !== responseTimeFieldValues.length) {
              if (DEBUG) {
                console.warn('Initial values not same length, you screw up?');
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
            const existingTimeFrames = this.storage[responseQueryExpressionAndStepString]['__time__'];
            const existingValueFrames = this.storage[responseQueryExpressionAndStepString][seriesLabelsIndexString];

            if (existingTimeFrames.length !== existingValueFrames.length) {
              if (DEBUG) {
                // Ok, if there are fewer time frames then value frames?
                console.error('Time frame and value frames are different lengths, something got screwed up!');
                console.log('existingTimeFrames', existingTimeFrames.length);
                console.log('existingValueFrames', existingValueFrames.length);
              }
            }

            //come on dude
            if (
              responseFrameValues &&
              responseFrameValues?.length > 0 &&
              existingValueFrames &&
              existingValueFrames.length > 0 &&
              existingTimeFrames &&
              responseTimeFieldValues.length > 0
            ) {
              let framesFromStorageRelevantToCurrentQuery: number[] = [];
              let existingValueFrameNewValuesRemoved: number[] = [];

              // Filter out values in storage from before query range
              for (let i = 0; i < existingTimeFrames?.length; i++) {
                const doesResponseNotContainFrameTimeValue =
                  responseTimeFieldValues.indexOf(existingTimeFrames[i]) === -1;

                // Remove values from before new start
                // Note this acts as the only eviction strategy so far, we only store frames that exist after the start of the current query
                const isFrameOlderThenQuery =
                  existingTimeFrames[i] <=
                  originalRange.from.valueOf() - PROMETHEUS_INCREMENTAL_QUERY_OVERLAP_DURATION_MS;
                if (isFrameOlderThenQuery && DEBUG) {
                  console.log(
                    'Frame is older then query, evicting',
                    existingTimeFrames[i] - originalRange.from.valueOf()
                  );
                }

                const isThisAFrameWeWantToCombineWithCurrentResult =
                  doesResponseNotContainFrameTimeValue && !isFrameOlderThenQuery;
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

              const allTimeValuesMerged = [...framesFromStorageRelevantToCurrentQuery, ...responseTimeFieldValues];

              const allValueFramesMerged = [...existingValueFrameNewValuesRemoved, ...responseFrameValues];

              // This is a reference to the original dataframes passed in, so we're mutating the original dataframe here!
              valueField!.values!.buffer = allValueFramesMerged;

              // If we set the time values here we'll screw up the rest of the loop, we should be checking to see if each series has the same time steps, or we need to clear the cache
              //@leon if allTimeValuesMerged is not same as previous iteration, wipe storage
              //// responseTimeField.values.buffer = allTimeValuesMerged;
              timeValuesStorage = allTimeValuesMerged;

              if (allValueFramesMerged.length !== allTimeValuesMerged.length) {
                if (DEBUG) {
                  console.warn('We are storing arrays of different lengths, wtf?!');
                  console.log('length of storage (values)', existingValueFrames.length);
                  console.log('length of storage (times)', existingTimeFrames.length);
                  console.log('length of response', responseTimeFieldValues.length);
                  console.log('length of frames were adding', framesFromStorageRelevantToCurrentQuery.length);
                  console.log('length of merged arrayas', allValueFramesMerged.length);
                }
              }

              this.storage[responseQueryExpressionAndStepString][seriesLabelsIndexString] = allValueFramesMerged;
              this.storage[responseQueryExpressionAndStepString]['__time__'] = allTimeValuesMerged;
            } else {
              if (DEBUG) {
                console.warn('no existing values found');
              }
            }
          }
        });

        // If we changed the time steps, let's mutate the dataframe
        if (timeValuesStorage.length > 0 && responseTimeField?.values) {
          responseTimeField.values.buffer = timeValuesStorage;
        }
      });
    });

    return dataFrames;
  };

  /**
   * @todo
   * @param data
   * @private
   */
  private preProcessDataFrames(data: DataFrame[] | DataFrameDTO[]) {
    //
    let lastLength = data[0]?.length ?? 0;

    let min = data[0].fields[0].values.get(0);
    let max = data[0].fields[0].values.get(data[0].fields[0].values.length - 1);

    for (let i = 0; i < data.length; i++) {
      // Come on dude!
      if (min > data[i].fields[0]?.values?.get(0)) {
        min = data[i]?.fields[0]?.values?.get(0);
      }

      if (max > data[i].fields[0].values.get(data[i].fields[0].values.length - 1)) {
        max = data[i].fields[0].values.get(data[i].fields[0].values.length - 1);
      }
    }

    // Could be rounding issue, for off by one
    //
    for (let i = 0; i < data.length; i++) {
      if (lastLength && lastLength !== data[i].length) {
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
   *
   * @param request
   */
  modifyRequestDurationsIfStorageOverlapsRequest(request: DataQueryRequest<PromQuery>): {
    request: DataQueryRequest<PromQuery>;
    originalRange?: TimeRange;
  } {
    const requestFrom = request.range.from;
    const requestTo = request.range.to;

    let canCache: Boolean[] = [];
    let neededDurations: Array<{ end: number; start: number }> = [];

    const interval = rangeUtil.intervalToSeconds(request.interval);

    for (let i = 0; i < request.targets.length; i++) {
      const target = request.targets[i];

      const cacheKey: string | undefined = this.createPrometheusStorageIndexFromRequestTarget(target, request);

      if (!cacheKey) {
        if (DEBUG) {
          console.warn('No Cache key was generated, targets cannot be streamed');
        }
        canCache.push(false);
        break;
      }

      // @leon exemplars could work, but they're not step/interval-aligned so the current algorithm of merging frames from storage with the response won't work
      if (target?.range !== true || target.hide || target.exemplar) {
        if (DEBUG) {
          console.log('target invalid for incremental querying', target);
        }
        break;
      }

      const previousResultForThisQuery = this.storage[cacheKey];

      if (previousResultForThisQuery) {
        const timeValuesFromStorage = previousResultForThisQuery[PROMETHEUS_STORAGE_TIME_INDEX];
        // const fieldValuesFromStorage = Object.values(previousResultForThisQuery)[0].fields.find(field => field.name === TIME_SERIES_VALUE_FIELD_NAME);
        // Assume that the added fields are contigious, and every series always has the most recent samples
        if (timeValuesFromStorage) {
          const cacheFrom = timeValuesFromStorage[0];
          const cacheTo = timeValuesFromStorage[timeValuesFromStorage.length - 1];

          // There is more logic we can do here to save some more bytes, for example, if the query window is entirely contained in the stored data, or potentially if the query starts before the stored data,
          // but ends during the duration, then we could then only query the values we need at the begining, instead of giving up and re-querying everything.

          // The expected case when the query start is contained in storage
          if (
            requestFrom.valueOf() >= cacheFrom &&
            requestFrom.valueOf() <= cacheTo &&
            requestTo.valueOf() >= cacheTo
          ) {
            canCache.push(true);

            // @leon this feels like a source of bugs

            const range = alignRange(
              cacheTo,
              requestTo.valueOf(),
              interval,
              this.timeSrv.timeRange().to.utcOffset() * 60
            );
            neededDurations.push({ start: range.start, end: range.end });
          } else {
            if (DEBUG) {
              console.log('invalid duration!');
              delete this.storage[cacheKey];
            }
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
      return { request: { ...request, range: timeRange }, originalRange: originalRange };
    } else {
      if (DEBUG) {
        console.warn('QUERY NOT CONTAINED BY CACHE, NOT MODIFYING REQUEST', request);
      }
    }

    if (DEBUG) {
      console.log('STORAGE', this.storage);
    }

    return { request: request };
  }
}
