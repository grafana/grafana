import { groupBy, partition } from 'lodash';
import { Observable, Subscriber, Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { DataQueryRequest, LoadingState, DataQueryResponse, QueryResultMetaStat } from '@grafana/data';

import { LokiDatasource } from './datasource';
import { combineResponses, replaceResponses } from './mergeResponses';
import { adjustTargetsFromResponseState, runSplitQuery } from './querySplitting';
import { getSelectorForShardValues, interpolateShardingSelector, requestSupportsSharding } from './queryUtils';
import { isRetriableError } from './responseUtils';
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
 *     - It sorts them by value, descending. Higher shard numbers correspond with the least volume.
 *     - It defines an initial group size, roughly Math.sqrt(amountOfShards).
 *     - It begins the querying loop with runNextRequest().
 * - runNextRequest() will create a group of groupSize shards from the nth shard (cycle), and has the following internal structure:
 *   . groupShardRequests() returns an array of shards from cycle to cycle + groupSize.
 *   . interpolateShardingSelector() will update the stream selector with the shard numbers in the current group.
 *   . After query execution:
 *     - If the response is successful:
 *       . It will add new data to the response with combineResponses()
 *       . Using the data and meta data of the response, updateGroupSizeFromResponse() will increase or decrease the group size.
 *       . nextRequest() will use the current cycle and group size to determine the next request or complete execution with done().
 *     - If the response is unsuccessful:
 *       . If the response is not a query error, and the group size bigger than 1, it will decrease the group size.
 *       . If the group size is already 1, it will retry the request up to 2 times.
 *       . If there are retry attempts, it will retry the current cycle, or else stop querying.
 * - Once all request groups have been executed, it will be done().
 */

export function runShardSplitQuery(datasource: LokiDatasource, request: DataQueryRequest<LokiQuery>) {
  const queries = datasource
    .interpolateVariablesInQueries(request.targets, request.scopedVars)
    .filter((query) => query.expr)
    .filter((query) => !query.hide);

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
  let retriesMap = new Map<string, number>();
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const runNextRequest = (subscriber: Subscriber<DataQueryResponse>, group: number, groups: ShardedQueryGroup[]) => {
    let nextGroupSize = groups[group].groupSize;
    const { shards, groupSize, cycle } = groups[group];
    let retrying = false;

    if (subquerySubscription != null) {
      subquerySubscription.unsubscribe();
      subquerySubscription = null;
    }

    const done = () => {
      mergedResponse.state = shouldStop ? LoadingState.Error : LoadingState.Done;
      subscriber.next(mergedResponse);
      subscriber.complete();
    };

    if (shouldStop) {
      done();
      return;
    }

    const nextRequest = () => {
      const nextGroup =
        groups[group + 1] && groupHasPendingRequests(groups[group + 1])
          ? groups[group + 1]
          : groups.find((shardGroup) => groupHasPendingRequests(shardGroup));

      if (nextGroup === undefined) {
        done();
        return;
      }
      groups[group].groupSize = nextGroupSize;
      runNextRequest(subscriber, groups.indexOf(nextGroup), groups);
    };

    const retry = (errorResponse?: DataQueryResponse) => {
      try {
        if (errorResponse && !isRetriableError(errorResponse)) {
          return false;
        }
      } catch (e) {
        console.error(e);
        shouldStop = true;
        return false;
      }

      if (groupSize !== undefined && groupSize > 1) {
        groups[group].groupSize = Math.floor(Math.sqrt(groupSize));
        debug(`Possible time out, new group size ${groups[group].groupSize}`);
        retrying = true;
        runNextRequest(subscriber, group, groups);
        return true;
      }

      const key = `${group}_${cycle}`;
      const retries = retriesMap.get(key) ?? 0;

      if (retries > 1) {
        shouldStop = true;
        return false;
      }

      retriesMap.set(key, retries + 1);

      retryTimer = setTimeout(
        () => {
          console.warn(`Retrying ${group} ${cycle} (${retries + 1})`);
          runNextRequest(subscriber, group, groups);
          retryTimer = null;
        },
        1500 * Math.pow(2, retries)
      ); // Exponential backoff

      retrying = true;

      return true;
    };

    const targets = adjustTargetsFromResponseState(groups[group].targets, mergedResponse);
    if (!targets.length) {
      nextRequest();
      return;
    }

    const shardsToQuery =
      shards && cycle !== undefined && groupSize ? groupShardRequests(shards, cycle, groupSize) : [];
    const subRequest = { ...request, targets: interpolateShardingSelector(targets, shardsToQuery) };
    // Request may not have a request id
    if (request.requestId) {
      subRequest.requestId =
        shardsToQuery.length > 0 ? `${request.requestId}_shard_${group}_${cycle}_${groupSize}` : request.requestId;
    }

    debug(shardsToQuery.length ? `Querying ${shardsToQuery.join(', ')}` : 'Running regular query');

    subquerySubscription = runSplitQuery(datasource, subRequest, {
      skipPartialUpdates: true,
      disableRetry: true,
    }).subscribe({
      next: (partialResponse: DataQueryResponse) => {
        if ((partialResponse.errors ?? []).length > 0 || partialResponse.error != null) {
          if (retry(partialResponse)) {
            return;
          }
        }
        if (groupSize && cycle !== undefined && shards !== undefined) {
          nextGroupSize = constrainGroupSize(
            cycle + groupSize,
            updateGroupSizeFromResponse(partialResponse, groups[group]),
            shards.length
          );
          if (nextGroupSize !== groupSize) {
            debug(`New group size ${nextGroupSize}`);
          }
        }
        mergedResponse =
          shardsToQuery.length > 0
            ? combineResponses(mergedResponse, partialResponse)
            : replaceResponses(mergedResponse, partialResponse);

        // When we delegate query running to runSplitQuery(), we will receive partial updates here, and complete
        // will be called when all the sub-requests were completed, so we need to show partial progress here.
        if (shardsToQuery.length === 0) {
          subscriber.next(mergedResponse);
        }
      },
      complete: () => {
        if (retrying) {
          return;
        }
        subscriber.next(mergedResponse);
        nextRequest();
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

  const response = new Observable<DataQueryResponse>((subscriber) => {
    groupTargetsByQueryType(splittingTargets, datasource, request).then((groupedRequests) => {
      runNextRequest(subscriber, 0, groupedRequests);
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

interface ShardedQueryGroup {
  targets: LokiQuery[];
  shards?: number[];
  groupSize?: number;
  cycle?: number;
}

async function groupTargetsByQueryType(
  targets: LokiQuery[],
  datasource: LokiDatasource,
  request: DataQueryRequest<LokiQuery>
) {
  const [shardedQueries, otherQueries] = partition(targets, (query) => requestSupportsSharding([query]));
  const groups: ShardedQueryGroup[] = [];

  if (otherQueries.length) {
    groups.push({
      targets: otherQueries,
    });
  }

  const selectorPartition = groupBy(shardedQueries, (query) => getSelectorForShardValues(query.expr));
  for (const selector in selectorPartition) {
    try {
      const values = await datasource.languageProvider.fetchLabelValues('__stream_shard__', {
        timeRange: request.range,
        streamSelector: selector,
      });
      const shards = values.map((value) => parseInt(value, 10));
      if (shards) {
        shards.sort((a, b) => b - a);
        debug(`Querying ${selector} with shards ${shards.join(', ')}`);
      }
      groups.push({
        targets: selectorPartition[selector],
        shards: shards.length ? shards : undefined,
        groupSize: shards.length ? getInitialGroupSize(shards) : undefined,
        cycle: 0,
      });
    } catch (error) {
      console.error(error, { msg: 'failed to fetch label values for __stream_shard__' });
      groups.push({
        targets: selectorPartition[selector],
      });
    }
  }

  return groups;
}

function groupHasPendingRequests(group: ShardedQueryGroup) {
  if (group.cycle === undefined || !group.groupSize || !group.shards) {
    return false;
  }
  const { cycle, groupSize, shards } = group;
  const nextCycle = Math.min(cycle + groupSize, shards.length);
  group.cycle = nextCycle;
  return cycle < shards.length && nextCycle <= shards.length;
}

function updateGroupSizeFromResponse(response: DataQueryResponse, group: ShardedQueryGroup) {
  const { groupSize: currentSize } = group;
  if (!currentSize) {
    return 1;
  }
  if (!response.data.length) {
    // Empty response, increase group size
    return currentSize + 1;
  }

  const metaExecutionTime: QueryResultMetaStat | undefined = response.data[0].meta?.stats?.find(
    (stat: QueryResultMetaStat) => stat.displayName === 'Summary: exec time'
  );

  if (metaExecutionTime) {
    const executionTime = Math.round(metaExecutionTime.value);
    debug(`${metaExecutionTime.value}`);
    // Positive scenarios
    if (executionTime <= 1) {
      return Math.floor(currentSize * 1.5);
    } else if (executionTime < 6) {
      return Math.ceil(currentSize * 1.1);
    }

    // Negative scenarios
    if (currentSize === 1) {
      return currentSize;
    } else if (executionTime < 20) {
      return Math.ceil(currentSize * 0.9);
    } else {
      return Math.floor(currentSize / 2);
    }
  }

  return currentSize;
}

/**
 * Prevents the group size for ever being more than maxFactor% of the pending shards.
 */
function constrainGroupSize(cycle: number, groupSize: number, shards: number) {
  const maxFactor = 0.7;
  return Math.min(groupSize, Math.max(Math.floor((shards - cycle) * maxFactor), 1));
}

function groupShardRequests(shards: number[], start: number, groupSize: number) {
  if (start === shards.length) {
    return [-1];
  }
  return shards.slice(start, start + groupSize);
}

function getInitialGroupSize(shards: number[]) {
  return Math.floor(Math.sqrt(shards.length));
}

// Enable to output debugging logs
const DEBUG_ENABLED = Boolean(localStorage.getItem(`loki.sharding_debug_enabled`));
function debug(message: string) {
  if (!DEBUG_ENABLED) {
    return;
  }
  console.log(message);
}
