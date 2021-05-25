import { Observable, of, OperatorFunction, ReplaySubject, Unsubscribable } from 'rxjs';
import { catchError, map, share } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import {
  dataFrameFromJSON,
  DataFrameJSON,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
  rangeUtil,
  TimeRange,
  withLoadingIndicator,
} from '@grafana/data';
import { FetchResponse, toDataQueryError } from '@grafana/runtime';
import { BackendSrv, getBackendSrv } from 'app/core/services/backend_srv';
import { preProcessPanelData } from 'app/features/query/state/runRequest';
import { GrafanaQuery } from 'app/types/unified-alerting-dto';
import { getTimeRangeForExpression } from '../utils/timeRange';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { setStructureRevision } from 'app/features/query/state/processing/revision';
import { cancelNetworkRequestsOnUnsubscribe } from 'app/features/query/state/processing/canceler';

export interface AlertingQueryResult {
  frames: DataFrameJSON[];
}

export interface AlertingQueryResponse {
  results: Record<string, AlertingQueryResult>;
}
export class AlertingQueryRunner {
  private subject: ReplaySubject<Record<string, PanelData>>;
  private subscription?: Unsubscribable;
  private lastResult: Record<string, PanelData>;

  constructor(private backendSrv = getBackendSrv()) {
    this.subject = new ReplaySubject(1);
    this.lastResult = {};
  }

  get(): Observable<Record<string, PanelData>> {
    return this.subject.asObservable();
  }

  run(queries: GrafanaQuery[]) {
    if (queries.length === 0) {
      const empty = initialState(queries, LoadingState.Done);
      return this.subject.next(empty);
    }

    this.subscription = runRequest(this.backendSrv, queries).subscribe({
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

const runRequest = (backendSrv: BackendSrv, queries: GrafanaQuery[]): Observable<Record<string, PanelData>> => {
  const initial = initialState(queries, LoadingState.Loading);
  const request = {
    data: { data: queries },
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

const initialState = (queries: GrafanaQuery[], state: LoadingState): Record<string, PanelData> => {
  return queries.reduce((dataByQuery: Record<string, PanelData>, query) => {
    dataByQuery[query.refId] = {
      state,
      series: [],
      timeRange: getTimeRange(query, queries),
    };

    return dataByQuery;
  }, {});
};

const getTimeRange = (query: GrafanaQuery, queries: GrafanaQuery[]): TimeRange => {
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
      results[refId] = {
        timeRange: dataByQuery[refId].timeRange,
        state: LoadingState.Done,
        series: result.frames.map(dataFrameFromJSON),
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
