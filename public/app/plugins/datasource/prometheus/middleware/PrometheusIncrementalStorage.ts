import {
  DataFrame, DataFrameDTO,
  DataQueryRequest,
  DataQueryResponse,
  DataQueryResponseData,
  dateTime, Field, FieldDTO, TIME_SERIES_TIME_FIELD_NAME,
  TimeRange
} from "@grafana/data/src";
import {PromQuery} from "../types";
import {cloneDeep} from "lodash";

const PROMETHEUS_INCREMENTAL_QUERY_OVERLAP_DURATION_MS = 60 * 10 * 1000;
const PROMETHEUS_STORAGE_TIME_INDEX = '__time__';
const PROMETHEUS_STORAGE_EXEMPLAR_INDEX = 'exemplar';

// Another issue: if the query window starts at a time when there is no results from the database, we'll always fail the cache check and pull fresh data, even though the cache has everything available
// Also the cache can def get really big for big queries, need to look into if we want to find a way to limit the size of requests we add to the cache?
export class PrometheusIncrementalStorage {
  private readonly storage: Record<string, Record<string, number[]>>;

  constructor(

  ) {
    this.storage = {};
  }


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

    // Iterate through all of the queries
    request.targets.forEach((target) => {
      // Filter out the series that aren't for this query
      const timeSeriesForThisQuery = data.filter((response) => response.refId === target.refId);
      timeSeriesForThisQuery.forEach((response) => {
        if (response?.meta?.custom?.resultType !== 'matrix') {
          return;
        }

        // For each query response get the time and the values
        const responseTimeField = response.fields?.find((field) => field.name === TIME_SERIES_TIME_FIELD_NAME);

        // We're consuming these dataFrames after the transform which will remove some duplicate time values that is sent in the raw response from prometheus
        const responseValueFields = response.fields?.filter((field) => field.name !== TIME_SERIES_TIME_FIELD_NAME);

        // Get the querystring that was executed on the prometheus server, this string contains the step time as well so we can use this as our "key" in the prometheus data frame storage
        const responseQueryExpressionAndStepString = this.createPrometheusStorageIndexFromRequestTarget(
          target,
          request
        );

        // If we aren't able to create the query expression string to be used as the index, we should stop now
        if (!responseQueryExpressionAndStepString) {
          console.warn('unable to generate flat index for !');
          return;
        }

        const previousDataFrames =
          responseQueryExpressionAndStepString in this.storage
            ? this.storage[responseQueryExpressionAndStepString]
            : false;

        // We're about to populate the cache if it doesn't exist, so let's prime the main object
        if (!(responseQueryExpressionAndStepString in this.storage)) {
          this.storage[responseQueryExpressionAndStepString] = {
            __time__: responseTimeField?.values?.toArray(),
          };
        }

        let timeValuesStorage: string | any[] = [];
        responseValueFields.forEach((valueField) => {
          const responseFrameValues: number[] | undefined = valueField?.values?.toArray();
          // Generate a unique name for this dataframe using the values

          const seriesLabelsIndexString =
            response?.meta?.custom?.resultType !== PROMETHEUS_STORAGE_EXEMPLAR_INDEX
              ? PrometheusIncrementalStorage.valueFrameToLabelsString(valueField)
              : PROMETHEUS_STORAGE_EXEMPLAR_INDEX + '__' + valueField?.name;

          const thisQueryHasNeverBeenDoneBefore =
            !this.storage || !previousDataFrames || !previousDataFrames[seriesLabelsIndexString];
          const thisQueryHasBeenDoneBefore = !thisQueryHasNeverBeenDoneBefore;

          //@leon types
          const responseTimeFieldValues: number[] = responseTimeField?.values?.toArray() ?? [];

          // Store the response if it'.s new
          if (thisQueryHasNeverBeenDoneBefore && seriesLabelsIndexString && responseFrameValues?.length) {
            this.storage[responseQueryExpressionAndStepString][seriesLabelsIndexString] =
              responseFrameValues;

            this.storage[responseQueryExpressionAndStepString]['__time__'] = responseTimeFieldValues;

          } else if (thisQueryHasBeenDoneBefore && seriesLabelsIndexString && originalRange) {
            // If the labels are the same as saved, append any new values, making sure that any additional data is taken from the newest response
            // @leon if the query is the last 10 minutes (or 2 hours)

            const existingTimeFrames =
              this.storage[responseQueryExpressionAndStepString]['__time__'];
            const existingValueFrames =
              this.storage[responseQueryExpressionAndStepString][seriesLabelsIndexString];

            if(existingTimeFrames.length !== existingValueFrames.length){
              console.error('Time frame and value frames are different lengths, something got screwed up!')

              console.log('existingTimeFrames', existingTimeFrames);
              console.log('existingValueFrames', existingValueFrames);
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
                // Make sure to exclude the overlap time
                // Also right now this breaks everything
                const isFrameOlderThenQuery =
                  existingTimeFrames[i] <
                  originalRange.from.valueOf() - PROMETHEUS_INCREMENTAL_QUERY_OVERLAP_DURATION_MS;
                if (isFrameOlderThenQuery) {
                  console.log(
                    'Frame is older then query, evicting',
                    existingTimeFrames[i] - originalRange.from.valueOf()
                  );
                }

                const isThisAFrameWeWantToCombineWithCurrentResult =
                  doesResponseNotContainFrameTimeValue && !isFrameOlderThenQuery;
                // Only add timeframes from the old data to the new data, if they aren't already contained in the new data
                if (isThisAFrameWeWantToCombineWithCurrentResult) {
                  if (existingValueFrames[i] !== undefined) {
                    framesFromStorageRelevantToCurrentQuery.push(existingTimeFrames[i]);
                    existingValueFrameNewValuesRemoved.push(existingValueFrames[i]);
                  }else{
                    console.warn('empty value frame?', i, existingValueFrames);
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

              this.storage[responseQueryExpressionAndStepString][seriesLabelsIndexString] =
                allValueFramesMerged;
              this.storage[responseQueryExpressionAndStepString]['__time__'] = allTimeValuesMerged;
            } else {
              console.warn('no existing values found');
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

    for (let i = 0; i < request.targets.length; i++) {
      const target = request.targets[i];

      const cacheKey: string | undefined = this.createPrometheusStorageIndexFromRequestTarget(target, request);

      if (!cacheKey) {
        console.warn('No Cache key was generated, targets cannot be streamed');
        canCache.push(false);
        break;
      }

      // @leon exemplars could work, but they're not step/interval-aligned so the current algorithm of merging frames from storage with the response won't work
      if (target?.range !== true || target.hide || target.exemplar) {
        console.log('target invalid for incremental querying', target);
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

          // The expected case when the query start is contained in storage, but the end is not, the query window moved forward in time
          if (requestFrom.valueOf() >= cacheFrom && requestTo.valueOf() >= cacheTo) {
            canCache.push(true);

            // @leon this feels like a source of bugs
            //alignRange(cacheTo, requestTo, target.step, this.timeSrv.timeRange().to.utcOffset() * 60);
            neededDurations.push({ start: cacheTo, end: requestTo.valueOf() });
          } else {
            console.log('invalid duration!');
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

      console.warn('QUERY IS CONTAINED BY CACHE, MODIFYING REQUEST', this.storage);

      // calculate new from/tos
      return { request: { ...request, range: timeRange }, originalRange: originalRange };
    } else {
      console.warn('QUERY NOT CONTAINED BY CACHE, NOT MODIFYING REQUEST', request);
    }

    return { request: request };
  }
}
