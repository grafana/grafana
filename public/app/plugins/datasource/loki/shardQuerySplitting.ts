import { groupBy, partition } from 'lodash';
import { Observable, Subscriber, Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import {
  DataQueryRequest,
  LoadingState,
  DataQueryResponse,
  DataFrame,
  Field,
  QueryResultMetaStat,
} from '@grafana/data';

import { LokiDatasource } from './datasource';
import { combineResponses } from './mergeResponses';
import {
  addShardingPlaceholderSelector,
  getSelectorForShardValues,
  interpolateShardingSelector,
  isLogsQuery,
  isQueryWithLineFilter,
} from './queryUtils';
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
 *       . If the group size is already 1, it will retry the request up to 4 times.
 *       . If there are retry attempts, it will retry the current cycle, or else stop querying.
 * - Once all request groups have been executed, it will be done().
 */

export function runShardSplitQuery(datasource: LokiDatasource, request: DataQueryRequest<LokiQuery>) {
  const queries = datasource
    .interpolateVariablesInQueries(request.targets, request.scopedVars)
    .filter((query) => query.expr)
    .filter((query) => !query.hide)
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
  let retriesMap = new Map<string, number>();
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const runNextRequest = (subscriber: Subscriber<DataQueryResponse>, group: number, groups: ShardedQueryGroup[]) => {
    let nextGroupSize = groups[group].groupSize;
    const { shards, groupSize, cycle } = groups[group];

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
      if (errorResponse?.errors && errorResponse.errors[0].message?.includes('maximum of series')) {
        console.warn(`Maximum series reached, skipping retry`);
        return false;
      } else if (errorResponse?.errors && errorResponse.errors[0].message?.includes('parse error')) {
        console.warn(`Parse error, skipping retry`);
        shouldStop = true;
        return false;
      }

      if (groupSize !== undefined && groupSize > 1) {
        groups[group].groupSize = Math.floor(Math.sqrt(groupSize));
        debug(`Possible time out, new group size ${groups[group].groupSize}`);
        runNextRequest(subscriber, group, groups);
        return true;
      }

      const key = `${group}_${cycle}`;
      const retries = retriesMap.get(key) ?? 0;
      if (retries > 3) {
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
        1000 * Math.pow(2, retries)
      ); // Exponential backoff

      return true;
    };

    const shardsToQuery =
      shards && cycle !== undefined && groupSize ? groupShardRequests(shards, cycle, groupSize) : [];
    const subRequest = { ...request, targets: interpolateShardingSelector(groups[group].targets, shardsToQuery) };
    // Request may not have a request id
    if (request.requestId) {
      subRequest.requestId =
        cycle !== undefined && groupSize
          ? `${request.requestId}_shard_${group}_${cycle}_${groupSize}`
          : request.requestId;
    }

    debug(shardsToQuery.length ? `Querying ${shardsToQuery.join(', ')}` : 'Running regular query');

    subquerySubscription = datasource.runQuery(subRequest).subscribe({
      next: (partialResponse: DataQueryResponse) => {
        if ((partialResponse.errors ?? []).length > 0 || partialResponse.error != null) {
          if (retry(partialResponse)) {
            return;
          }
        }
        if (groupSize) {
          nextGroupSize = updateGroupSizeFromResponse(partialResponse, groupSize);
          if (nextGroupSize !== groupSize) {
            debug(`New group size ${nextGroupSize}`);
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
  const [shardedQueries, otherQueries] = partition(targets, (query) => {
    if (isLogsQuery(query.expr)) {
      return isQueryWithLineFilter(query.expr);
    }
    return true;
  });

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

function updateGroupSizeFromResponse(response: DataQueryResponse, currentSize: number) {
  if (!response.data.length) {
    // Empty response, increase group size
    return currentSize + 1;
  }

  const metaExecutionTime: QueryResultMetaStat | undefined = response.data[0].meta?.stats?.find(
    (stat: QueryResultMetaStat) => stat.displayName === 'Summary: exec time'
  );

  if (metaExecutionTime) {
    debug(`${metaExecutionTime.value}`);
    // Positive scenarios
    if (metaExecutionTime.value < 1) {
      return currentSize * 2;
    } else if (metaExecutionTime.value < 6) {
      return currentSize + 2;
    } else if (metaExecutionTime.value < 16) {
      return currentSize + 1;
    }

    // Negative scenarios
    if (currentSize === 1) {
      return currentSize;
    } else if (metaExecutionTime.value < 20) {
      return currentSize - 1;
    } else {
      return Math.floor(currentSize / 2);
    }
  }

  return currentSize;
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

function ensureMaxLines(response: DataQueryResponse, request: DataQueryRequest<LokiQuery>) {
  const logQueries = request.targets.filter((target) => isLogsQuery(target.expr));
  for (const query of logQueries) {
    const frame = response.data.find((frame: DataFrame) => frame.refId === query.refId);
    if (!frame) {
      continue;
    }
    return response;
    frame.fields.forEach((field: Field) => {
      field.values.splice(query.maxLines || 1000);
    });
    frame.length = frame.fields[0]?.values.length ?? 0;
  }

  return response;
}
