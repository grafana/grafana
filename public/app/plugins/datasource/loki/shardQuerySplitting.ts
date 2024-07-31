import { partition } from 'lodash';
import { Observable, Subscriber, Subscription, tap } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import {
  DataQueryRequest,
  LoadingState,
  DataQueryResponse,
} from '@grafana/data';
import { combineResponses } from '@grafana/o11y-ds-frontend';

import { LokiDatasource } from './datasource';
import { adjustTargetsFromResponseState, querySupportsSplitting } from './querySplitting';
import { addShardingPlaceholderSelector, interpolateShardingSelector } from './queryUtils';
import { trackQuery } from './tracking';
import { LokiQuery } from './types';

export function splitQueriesByStreamShard(datasource: LokiDatasource, request: DataQueryRequest<LokiQuery>, splittingTargets: LokiQuery[], nonSplittingTargets: LokiQuery[] = []) {
  let endShard = 0;
  let shouldStop = false;
  let mergedResponse: DataQueryResponse = { data: [], state: LoadingState.Streaming, key: uuidv4() };
  let subquerySubsciption: Subscription | null = null;

  const runNextRequest = (subscriber: Subscriber<DataQueryResponse>, shard: number) => {
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
      const nextShard = shard+1;
      if (nextShard <= endShard) {
        runNextRequest(subscriber, nextShard);
        return;
      }
      done();
    };

    const targets = adjustTargetsFromResponseState(splittingTargets, mergedResponse);
    if (!targets.length) {
      nextRequest();
      return;
    }

    const subRequest = { ...request, targets: interpolateShardingSelector(targets, shard) };
    // Request may not have a request id
    if (request.requestId) {
      subRequest.requestId = `${request.requestId}_shard_${shard}`;
    }

    subquerySubsciption = datasource.runQuery(subRequest).subscribe({
      next: (partialResponse) => {
        mergedResponse = combineResponses(mergedResponse, partialResponse, false);
        if ((mergedResponse.errors ?? []).length > 0 || mergedResponse.error != null) {
          shouldStop = true;
        }
      },
      complete: () => {
        subscriber.next(mergedResponse);
        nextRequest();
      },
      error: (error) => {
        console.error(error);
        subscriber.next(mergedResponse);
        nextRequest();
      },
    });
  };

  const response = new Observable<DataQueryResponse>((subscriber) => {
    datasource.languageProvider.fetchLabelValues('__stream_shard__', { timeRange: request.range })
      .then((values) => {
        values.forEach(shard => {
          if (parseInt(shard, 10) > endShard) {
            endShard = parseInt(shard, 10);
          }
        });
        console.log(`Sharding up to ${endShard}`);
        runNextRequest(subscriber, -1);
      }).catch((e) => {
        console.error(e);
        shouldStop = true;
        runNextRequest(subscriber, 0);
      })
    return () => {
      shouldStop = true;
      if (subquerySubsciption != null) {
        subquerySubsciption.unsubscribe();
      }
    };
  });

  return response;
}

export function runShardSplitQuery(datasource: LokiDatasource, request: DataQueryRequest<LokiQuery>) {
  const queries = request.targets.filter((query) => !query.hide).filter((query) => query.expr);
  let [nonSplittingTargets, splittingTargets] = partition(queries, (query) => !querySupportsSplitting(query));

  splittingTargets = splittingTargets.map(target => ({
    ...target,
    expr: addShardingPlaceholderSelector(target.expr),
  }))

  const startTime = new Date();
  return splitQueriesByStreamShard(datasource, request, splittingTargets, nonSplittingTargets).pipe(
    tap((response) => {
      if (response.state === LoadingState.Done) {
        trackQuery(response, request, startTime);
      }
    })
  );
}
