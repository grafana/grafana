import { partition } from 'lodash';
import { Observable, Subscriber, Subscription, tap } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import {
  DataQueryRequest,
  LoadingState,
  DataQueryResponse,
} from '@grafana/data';
import { combineResponses, mergeFrames } from '@grafana/o11y-ds-frontend';

import { LokiDatasource } from './datasource';
import { adjustTargetsFromResponseState, querySupportsSplitting } from './querySplitting';
import { addShardingPlaceholderSelector } from './queryUtils';
import { trackQuery } from './tracking';
import {LokiQuery, SubQueryResponse} from './types';

export function splitQueriesByStreamShard(datasource: LokiDatasource, request: DataQueryRequest<LokiQuery>, splittingTargets: LokiQuery[], nonSplittingTargets: LokiQuery[] = []) {
  let shouldStop = false;
  let mergedResponse: DataQueryResponse = { data: [], state: LoadingState.Streaming, key: uuidv4() };
  let subquerySubsciption: Subscription | null = null;

  const runNextRequest = (subscriber: Subscriber<DataQueryResponse>, subRequests: Array<DataQueryRequest<LokiQuery>>, n: number, shard?: number) => {
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
      if (n === 0) {
        done();
        return;
      }
      if (n >= 0) {
        runNextRequest(subscriber, subRequests, n-1);
        return;
      }
      done();
    };

    const targets = adjustTargetsFromResponseState(splittingTargets, mergedResponse);
    if (!targets.length) {
      nextRequest();
      return;
    }

    subquerySubsciption = datasource.runQuery(subRequests[n]).subscribe({
      next: (partialResponse) => {
        mergedResponse = combineResponses(mergedResponse, partialResponse, mergeFrames);
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
    let lokiQuery = request.targets[0]
    let lokiRequests: Array<DataQueryRequest<LokiQuery>> = []
    datasource.fetchSubQueries(lokiQuery, request.range)
      .then((s ) => {
        lokiRequests = parseToLokiRequests(s, request)
        runNextRequest(subscriber, lokiRequests, s.results.length - 1);
      }).catch((e) => {
        console.error(e);
        shouldStop = true;
        runNextRequest(subscriber, lokiRequests, -1);
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

function parseToLokiRequests(s: SubQueryResponse, originalReq: DataQueryRequest<LokiQuery>): Array<DataQueryRequest<LokiQuery>> {
  let result: Array<DataQueryRequest<LokiQuery>> = [];

  let subQueries = s.results;
  // iterate over subQueries
  subQueries.map((subQuery) => {
      result.push({
        requestId: subQuery.id,
        startTime: subQuery.start,
        endTime: subQuery.end,
        app: originalReq.app,
        interval: originalReq.interval,
        intervalMs: originalReq.intervalMs,
        range: originalReq.range,
        scopedVars: originalReq.scopedVars,
        targets: [{
          expr: subQuery.query,
          refId: originalReq.targets[0].refId,
        }],
        timezone: ""

      });
  });

  return result;
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
