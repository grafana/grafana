import { Observable, Subscriber, Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { DataQueryRequest, LoadingState, DataQueryResponse, TimeRange } from '@grafana/data';

import { LokiDatasource } from './datasource';
import { combineResponses } from './mergeResponses';
import { addShardingPlaceholderSelector, getSelectorForShardValues, interpolateShardingSelector } from './queryUtils';
import { LokiQuery } from './types';

/**
 * Query splitting by stream shards.
 * Query splitting was introduced in Loki to optimize querying for long intervals and high volume of data,
 * dividing a big request into smaller sub-requests, combining and displaying the results as they arrive.
 *
 * This approach, inspired by the time-based query splitting, takes advantage of the __stream_shard__
 * internal label, representing how data is spread into different sources that can be queried individually.
 *
 * The main entry point of this module is runShardSplitQuery(), which prepares the query for execution and
 * passes it to splitQueriesByStreamShard() to begin the querying loop.
 *
 * splitQueriesByStreamShard() has the following structure:
 * - Creates and returns an Observable to which the UI will subscribe
 * - Requests the __stream_shard__ values of the selected service:
 *   . If there are no shard values, it falls back to the standard querying approach of the data source in runNonSplitRequest()
 *   . If there are shards:
 *     - It groups the shard requests in an array of arrays of shard numbers in groupShardRequests()
 *     - It begins the querying loop with runNextRequest()
 * - runNextRequest() will send a query using the nth (cycle) shard group, and has the following internal structure:
 *   . adjustTargetsFromResponseState() will filter log queries targets that already received the requested maxLines
 *   . interpolateShardingSelector() will update the stream selector with the current shard numbers
 *   . After query execution:
 *     - If the response is successful:
 *       . It will add new data to the response with combineResponses()
 *       . nextRequest() will use the current cycle and the total groups to determine the next request or complete execution with done()
 *     - If the response is unsuccessful:
 *       . If there are retry attempts, it will retry the current cycle, or else continue with the next cycle
 *       . If the returned error is Maximum series reached, it will not retry
 * - Once all request groups have been executed, it will be done()
 */

export function runShardSplitQuery(datasource: LokiDatasource, request: DataQueryRequest<LokiQuery>) {
  const queries = datasource
    .interpolateVariablesInQueries(request.targets, request.scopedVars)
    .filter((query) => query.expr)
    .map((target) => ({
      ...target,
      expr: addShardingPlaceholderSelector(target.expr),
    }));

  return splitQueriesByStreamShard(datasource, request, queries);
}

function splitQueriesByStreamShard(
  datasource: LokiDatasource,
  request: DataQueryRequest<LokiQuery>,
  splittingTargets: LokiQuery[]
) {
  let shouldStop = false;
  let mergedResponse: DataQueryResponse = { data: [], state: LoadingState.Streaming, key: uuidv4() };
  let subquerySubscription: Subscription | null = null;
  let retriesMap = new Map<number, number>();
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const runNextRequest = (subscriber: Subscriber<DataQueryResponse>, cycle: number, shardRequests: number[][]) => {
    if (subquerySubscription != null) {
      subquerySubscription.unsubscribe();
      subquerySubscription = null;
    }

    if (shouldStop) {
      subscriber.complete();
      return;
    }

    const done = () => {
      mergedResponse.state = LoadingState.Done;
      subscriber.next(mergedResponse);
      subscriber.complete();
    };

    const nextRequest = () => {
      const nextCycle = cycle + 1;
      if (nextCycle < shardRequests.length) {
        runNextRequest(subscriber, nextCycle, shardRequests);
        return;
      }
      done();
    };

    const retry = (errorResponse?: DataQueryResponse) => {
      if (errorResponse?.errors && errorResponse.errors[0].message?.includes('maximum of series')) {
        console.log(`Maximum series reached, skipping retry`);
        return false;
      }

      const retries = retriesMap.get(cycle) ?? 0;
      if (retries > 3) {
        return false;
      }

      retriesMap.set(cycle, retries + 1);

      retryTimer = setTimeout(
        () => {
          console.log(`Retrying ${cycle} (${retries + 1})`);
          runNextRequest(subscriber, cycle, shardRequests);
          retryTimer = null;
        },
        1500 * Math.pow(2, retries)
      ); // Exponential backoff

      return true;
    };

    const subRequest = { ...request, targets: interpolateShardingSelector(splittingTargets, shardRequests, cycle) };
    // Request may not have a request id
    if (request.requestId) {
      subRequest.requestId = `${request.requestId}_shard_${cycle}`;
    }

    subquerySubscription = datasource.runQuery(subRequest).subscribe({
      next: (partialResponse: DataQueryResponse) => {
        if ((partialResponse.errors ?? []).length > 0 || partialResponse.error != null) {
          if (retry(partialResponse)) {
            return;
          }
        }
        mergedResponse = combineResponses(mergedResponse, partialResponse);
      },
      complete: () => {
        // Prevent flashing "no data"
        if (mergedResponse.data.length) {
          subscriber.next(mergedResponse);
        }
        nextRequest();
        if (retryTimer) {
          clearTimeout(retryTimer);
        }
      },
      error: (error: unknown) => {
        console.error(error, { msg: 'failed to shard' });
        subscriber.next(mergedResponse);
        if (retry()) {
          return;
        }
        nextRequest();
      },
    });
  };

  const runNonSplitRequest = (subscriber: Subscriber<DataQueryResponse>) => {
    subquerySubscription = datasource.runQuery(request).subscribe({
      next: (partialResponse: DataQueryResponse) => {
        mergedResponse = partialResponse;
      },
      complete: () => {
        subscriber.next(mergedResponse);
      },
      error: (error: unknown) => {
        console.error(error, { msg: 'runNonSplitRequest subscription error' });
        subscriber.error(mergedResponse);
      },
    });
  };

  const response = new Observable<DataQueryResponse>((subscriber) => {
    const selector = getSelectorForShardValues(splittingTargets[0].expr);
    datasource.languageProvider
      .fetchLabelValues('__stream_shard__', {
        timeRange: request.range,
        streamSelector: selector ? selector : undefined,
      })
      .then((values: string[]) => {
        const shards = values.map((value) => parseInt(value, 10));
        if (!shards || !shards.length) {
          console.warn(`Shard splitting not supported. Issuing a regular query.`);
          runNonSplitRequest(subscriber);
        } else {
          const shardRequests = groupShardRequests(shards, request.range);
          runNextRequest(subscriber, 0, shardRequests);
        }
      })
      .catch((e: unknown) => {
        console.error(e, { msg: 'failed to fetch label values for __stream_shard__' });
        shouldStop = true;
        runNonSplitRequest(subscriber);
      });
    return () => {
      shouldStop = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      if (subquerySubscription != null) {
        subquerySubscription.unsubscribe();
        subquerySubscription = null;
      }
    };
  });

  return response;
}

function groupShardRequests(shards: number[], range: TimeRange) {
  const hours = range.to.diff(range.from, 'hour');

  // Spread low and high volume around
  shards = spreadSort(shards);
  console.log(`Querying ${shards.join(', ')} shards`);

  const maxRequests = calculateMaxRequests(shards.length, hours);
  const groupSize = Math.ceil(shards.length / maxRequests);
  const requests: number[][] = [];

  for (let i = 0; i < shards.length; i += groupSize) {
    const request: number[] = [];
    for (let j = i; j < i + groupSize && j < shards.length; j += 1) {
      request.push(shards[j]);
    }
    requests.push(request);
  }

  requests.push([-1]);

  return requests;
}

/**
 * Simple approach to calculate a maximum amount of requests to send based on
 * the available shards and the requested interval.
 */
function calculateMaxRequests(shards: number, hours: number) {
  if (hours < 24) {
    return Math.max(Math.min(Math.ceil(Math.sqrt(shards)), shards - 1), 1);
  }
  return shards;
}

function spreadSort(shards: number[]) {
  shards.sort((a, b) => b - a);
  let mid = Math.floor(shards.length / 2);
  let result = [];
  for (let i = 0; i < mid; i++) {
    result.push(shards[i], shards[mid + i]);
  }
  if (shards.length % 2 !== 0) {
    result.push(shards[shards.length - 1]);
  }
  return result;
}
