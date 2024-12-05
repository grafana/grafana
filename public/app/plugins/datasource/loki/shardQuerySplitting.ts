import { groupBy, partition } from 'lodash';
import { LRUCache } from 'lru-cache';
import { Observable, Subscriber, Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { DataQueryRequest, LoadingState, DataQueryResponse, TimeRange, getValueFormat } from '@grafana/data';

import { LokiDatasource } from './datasource';
import { combineResponses, replaceResponses } from './mergeResponses';
import { adjustTargetsFromResponseState, runSplitQuery } from './querySplitting';
import { getSelectorForShardValues, interpolateShardingSelector, requestSupportsSharding } from './queryUtils';
import { isRetriableError } from './responseUtils';
import { LokiQuery, QueryStats } from './types';

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
    const { shards, cycle } = groups[group];
    const useTimeSplitting = cycle && shards && shards[cycle].timeSplit;
    const groupSize = cycle && shards && shards[cycle].size;
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
      runNextRequest(subscriber, groups.indexOf(nextGroup), groups);
    };

    const retry = (errorResponse?: DataQueryResponse) => {
      const targets = interpolateShardingSelector(groups[group].targets, shardsToQuery);
      for (const query of targets) {
        getStats(query.expr, request.range, datasource).then((stats) => {
          if (!stats) {
            return;
          }
          const { text, suffix } = getValueFormat('bytes')(stats.bytes, 1);
          console.log(`Query ${query.expr} tried to access ${text}${suffix}`);
        });
      }

      try {
        if (errorResponse && !isRetriableError(errorResponse)) {
          return false;
        }
      } catch (e) {
        console.error(e);
        shouldStop = true;
        return false;
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

    const shardsToQuery = shards && cycle !== undefined ? getShardsToRequest(shards, cycle) : [];
    const subRequest = { ...request, targets: interpolateShardingSelector(targets, shardsToQuery) };
    // Request may not have a request id
    if (request.requestId) {
      subRequest.requestId =
        shardsToQuery.length > 0 ? `${request.requestId}_shard_${group}_${cycle}` : request.requestId;
    }

    debug(shardsToQuery.length ? `Querying ${shardsToQuery.join(', ')}` : 'Running regular query');

    if (useTimeSplitting && groupSize) {
      subRequest.targets = addSplittingDurationToTargets(subRequest.targets, groupSize);
    }

    const queryRunner =
      shardsToQuery.length > 0 && !useTimeSplitting
        ? datasource.runQuery.bind(datasource, subRequest)
        : runSplitQuery.bind(null, datasource, subRequest, true);
    subquerySubscription = queryRunner().subscribe({
      next: (partialResponse: DataQueryResponse) => {
        if ((partialResponse.errors ?? []).length > 0 || partialResponse.error != null) {
          if (retry(partialResponse)) {
            return;
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
  shards?: GroupedWeightedShards[];
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
      shards.sort((a, b) => b - a);
      if (shards.length > 0) {
        shards.push(-1);
      }
      const weightedShards: WeightedShard[] = [];

      for (const shard of shards) {
        const interpolated = interpolateShardingSelector([{ expr: selector, refId: `shard_${shard}` }], [shard]);
        const stats = await getStats(interpolated[0].expr, request.range, datasource);
        if (!stats) {
          weightedShards.push({
            shard,
            size: 0,
          });
          continue;
        }
        weightedShards.push({
          shard,
          size: stats.bytes,
        });
      }

      if (shards) {
        debug(`Querying ${selector} with shards ${shards.join(', ')}`);
      }

      const groupedWeightedShards = groupShardsByWeight(weightedShards);
      groups.push({
        targets: selectorPartition[selector],
        shards: groupedWeightedShards,
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

function getShardsToRequest(shards: GroupedWeightedShards[], cycle: number) {
  if (cycle === shards.length) {
    return [-1];
  }
  return shards[cycle].shards;
}

function groupHasPendingRequests(group: ShardedQueryGroup) {
  if (group.cycle === undefined || !group.shards) {
    return false;
  }
  if (group.shards[group.cycle + 1]) {
    group.cycle += 1;
    return true;
  }
  return false;
}

// Enable to output debugging logs
const DEBUG_ENABLED = Boolean(localStorage.getItem(`loki.sharding_debug_enabled`));
function debug(message: string) {
  if (!DEBUG_ENABLED) {
    return;
  }
  console.log(message);
}

interface WeightedShard {
  shard: number;
  size: number;
}

const statsCache = new LRUCache<string, QueryStats>({ max: 10 });
async function getStats(expr: string, range: TimeRange, datasource: LokiDatasource) {
  const key = `${expr}.${range.from.valueOf()}.${range.to.valueOf}.${datasource.uid}`;
  const cached = statsCache.get(key);
  if (cached) {
    return cached;
  }
  const stats = await datasource.getStats({ expr, refId: `stats_${Math.random()}` }, range);
  if (!stats) {
    return null;
  }
  statsCache.set(key, stats);
  return stats;
}

interface GroupedWeightedShards {
  shards: number[];
  timeSplit: boolean;
  size: number;
}

function groupShardsByWeight(shards: WeightedShard[]): GroupedWeightedShards[] {
  const gb = Math.pow(2, 30);
  const splittingLimit = 250 * gb;
  if (!shards.some((shard) => shard.size > 0)) {
    return [
      {
        shards: shards.map((shard) => shard.shard),
        timeSplit: false,
        size: -1,
      },
    ];
  }
  const groups: GroupedWeightedShards[] = [];
  let currentSize = 0;
  let group: number[] = [];
  for (const shard of shards) {
    if (currentSize + shard.size < splittingLimit) {
      currentSize += shard.size;
      group.push(shard.shard);
    } else {
      if (group.length > 0) {
        groups.push({
          shards: group,
          timeSplit: currentSize > splittingLimit,
          size: currentSize,
        });
      }
      group = [shard.shard];
      currentSize = shard.size;
    }
  }

  if (group.length > 0) {
    groups.push({
      shards: group,
      timeSplit: currentSize > splittingLimit,
      size: currentSize,
    });
  }

  for (const group of groups) {
    const { text, suffix } = getValueFormat('bytes')(group.size, 1);
    debug(`${group.shards}  ${text}${suffix} (time split: ${group.timeSplit})`);
  }

  return groups;
}

function addSplittingDurationToTargets(targets: LokiQuery[], bytes: number) {
  const gb = Math.pow(2, 30);
  const tb = Math.pow(2, 40);

  let chunkRangeMs = 24 * 60 * 60 * 1000;
  if (bytes < tb) {
    const gbs = Math.ceil(Math.round(bytes / gb) / 100) + 1;
    chunkRangeMs = Math.round(chunkRangeMs / gbs);
  } else {
    const tbs = Math.ceil(Math.round(bytes / tb)) + 1;
    chunkRangeMs = Math.round(chunkRangeMs / (tbs * 10));
  }
  const minChunkRangeMs = 3 * 60 * 60 * 1000;
  chunkRangeMs = chunkRangeMs < minChunkRangeMs ? minChunkRangeMs : chunkRangeMs;
  const hours = Math.round(chunkRangeMs / 1000 / 60 / 60);

  targets.forEach((query) => (query.splitDuration = `${hours}h`));
  console.log(`${hours}h`);

  return targets;
}
