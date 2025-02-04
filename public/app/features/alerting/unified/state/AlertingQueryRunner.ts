import { reject } from 'lodash';
import { Observable, OperatorFunction, ReplaySubject, Unsubscribable, of } from 'rxjs';
import { catchError, map, share } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import {
  DataFrameJSON,
  LoadingState,
  PanelData,
  TimeRange,
  dataFrameFromJSON,
  getDefaultTimeRange,
  preProcessPanelData,
  rangeUtil,
  withLoadingIndicator,
} from '@grafana/data';
import { DataSourceWithBackend, FetchResponse, getDataSourceSrv, toDataQueryError } from '@grafana/runtime';
import { BackendSrv, getBackendSrv } from 'app/core/services/backend_srv';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { cancelNetworkRequestsOnUnsubscribe } from 'app/features/query/state/processing/canceler';
import { setStructureRevision } from 'app/features/query/state/processing/revision';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { createDagFromQueries, getDescendants } from '../components/rule-editor/dag';
import { getTimeRangeForExpression } from '../utils/timeRange';

export interface AlertingQueryResult {
  error?: string;
  status?: number; // HTTP status error
  frames: DataFrameJSON[];
}

export interface AlertingQueryResponse {
  results: Record<string, AlertingQueryResult>;
}
export class AlertingQueryRunner {
  private subject: ReplaySubject<Record<string, PanelData>>;
  private subscription?: Unsubscribable;
  private lastResult: Record<string, PanelData>;

  constructor(
    private backendSrv = getBackendSrv(),
    private dataSourceSrv = getDataSourceSrv()
  ) {
    this.subject = new ReplaySubject(1);
    this.lastResult = {};
  }

  get(): Observable<Record<string, PanelData>> {
    return this.subject.asObservable();
  }

  async run(queries: AlertQuery[], condition: string) {
    const empty = initialState(queries, LoadingState.Done);
    const queriesToRun = await this.prepareQueries(queries);

    if (queriesToRun.length === 0) {
      return this.subject.next(empty);
    }

    this.subscription = runRequest(this.backendSrv, queriesToRun, condition).subscribe({
      next: (dataPerQuery) => {
        const nextResult = applyChange(dataPerQuery, (refId, data) => {
          const previous = this.lastResult[refId];
          const preProcessed = preProcessPanelData(data, previous);
          return setStructureRevision(preProcessed, previous);
        });

        this.lastResult = nextResult;
        this.subject.next(this.lastResult);
      },

      error: (error: Error) => {
        this.lastResult = mapErrorToPanelData(this.lastResult, error);
        this.subject.next(this.lastResult);
      },
    });
  }

  // this function will omit any invalid queries and all of its descendants from the list of queries
  // to do this we will convert the list of queries into a DAG and walk the invalid node's output edges recursively
  async prepareQueries(queries: AlertQuery[]) {
    const queriesToExclude: string[] = [];

    // convert our list of queries to a graph
    const queriesGraph = createDagFromQueries(queries);

    // find all invalid nodes and omit those and their child nodes from the final queries array
    // ⚠️ also make sure all dependent nodes are omitted, otherwise we will be evaluating a broken graph with missing references
    for (const query of queries) {
      const refId = query.model.refId;

      if (isExpressionQuery(query.model)) {
        continue;
      }

      const dataSourceInstance = await this.dataSourceSrv.get(query.datasourceUid);
      const skipRunningQuery =
        dataSourceInstance instanceof DataSourceWithBackend &&
        dataSourceInstance.filterQuery &&
        !dataSourceInstance.filterQuery(query.model);

      if (skipRunningQuery) {
        const descendants = getDescendants(refId, queriesGraph);
        queriesToExclude.push(refId, ...descendants);
      }
    }

    return reject(queries, (q) => queriesToExclude.includes(q.model.refId));
  }

  cancel() {
    if (!this.subscription) {
      return;
    }
    this.subscription.unsubscribe();

    let requestIsRunning = false;

    const nextResult = applyChange(this.lastResult, (refId, data) => {
      if (data.state === LoadingState.Loading) {
        requestIsRunning = true;
      }

      return {
        ...data,
        state: LoadingState.Done,
      };
    });

    if (requestIsRunning) {
      this.subject.next(nextResult);
    }
  }

  destroy() {
    if (this.subject) {
      this.subject.complete();
    }

    this.cancel();
  }
}

const runRequest = (
  backendSrv: BackendSrv,
  queries: AlertQuery[],
  condition: string
): Observable<Record<string, PanelData>> => {
  const initial = initialState(queries, LoadingState.Loading);
  const request = {
    data: { data: queries, condition },
    url: '/api/v1/eval',
    method: 'POST',
    requestId: uuidv4(),
  };

  return withLoadingIndicator({
    whileLoading: initial,
    source: backendSrv.fetch<AlertingQueryResponse>(request).pipe(
      mapToPanelData(initial),
      catchError((error) => of(mapErrorToPanelData(initial, error))),
      cancelNetworkRequestsOnUnsubscribe(backendSrv, request.requestId),
      share()
    ),
  });
};

const initialState = (queries: AlertQuery[], state: LoadingState): Record<string, PanelData> => {
  return queries.reduce((dataByQuery: Record<string, PanelData>, query) => {
    dataByQuery[query.refId] = {
      state,
      series: [],
      timeRange: getTimeRange(query, queries),
    };

    return dataByQuery;
  }, {});
};

const getTimeRange = (query: AlertQuery, queries: AlertQuery[]): TimeRange => {
  if (isExpressionQuery(query.model)) {
    const relative = getTimeRangeForExpression(query.model, queries);
    return rangeUtil.relativeToTimeRange(relative);
  }

  if (!query.relativeTimeRange) {
    console.warn(`Query with refId: ${query.refId} did not have any relative time range, using default.`);
    return getDefaultTimeRange();
  }

  return rangeUtil.relativeToTimeRange(query.relativeTimeRange);
};

const mapToPanelData = (
  dataByQuery: Record<string, PanelData>
): OperatorFunction<FetchResponse<AlertingQueryResponse>, Record<string, PanelData>> => {
  return map((response) => {
    const { data } = response;
    const results: Record<string, PanelData> = {};

    for (const [refId, result] of Object.entries(data.results)) {
      const { error, status, frames = [] } = result;

      // extract errors from the /eval results
      const errors = error ? [{ message: error, refId, status }] : [];

      results[refId] = {
        errors,
        timeRange: dataByQuery[refId].timeRange,
        state: LoadingState.Done,
        series: frames.map(dataFrameFromJSON),
      };
    }

    return results;
  });
};

const mapErrorToPanelData = (lastResult: Record<string, PanelData>, error: Error): Record<string, PanelData> => {
  const queryError = toDataQueryError(error);

  return applyChange(lastResult, (refId, data) => {
    return {
      ...data,
      state: LoadingState.Error,
      error: queryError,
    };
  });
};

const applyChange = (
  initial: Record<string, PanelData>,
  change: (refId: string, data: PanelData) => PanelData
): Record<string, PanelData> => {
  const nextResult: Record<string, PanelData> = {};

  for (const [refId, data] of Object.entries(initial)) {
    nextResult[refId] = change(refId, data);
  }

  return nextResult;
};
