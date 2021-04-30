import { merge, Observable, of, ReplaySubject, timer, Unsubscribable } from 'rxjs';
import { catchError, finalize, map, mapTo, share, takeUntil } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import {
  compareArrayValues,
  compareDataFrameStructures,
  dataFrameFromJSON,
  DataFrameJSON,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
  rangeUtil,
  TimeRange,
} from '@grafana/data';
import { BackendSrvRequest, FetchResponse, toDataQueryError } from '@grafana/runtime';
import { BackendSrv, getBackendSrv } from 'app/core/services/backend_srv';
import { preProcessPanelData } from 'app/features/query/state/runRequest';
import { GrafanaQuery } from 'app/types/unified-alerting-dto';
import { getTimeRangeForExpression } from '../unified/utils/timeRange';
import { isExpressionQuery } from 'app/features/expressions/guards';

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
        const nextResult: Record<string, PanelData> = {};

        for (const [refId, data] of Object.entries(dataPerQuery)) {
          const previous = this.lastResult[refId];
          nextResult[refId] = setStructureRevision(data, previous);
        }

        this.lastResult = nextResult;
        this.subject.next(this.lastResult);
      },
      error: (error) => console.error('PanelQueryRunner Error', error),
    });
  }

  cancel() {
    if (!this.subscription) {
      return;
    }
    this.subscription.unsubscribe();

    const nextResult: Record<string, PanelData> = {};
    let loading = false;

    for (const [refId, data] of Object.entries(this.lastResult)) {
      if (data.state === LoadingState.Loading) {
        loading = true;
      }

      nextResult[refId] = {
        ...data,
        state: LoadingState.Done,
      };
    }

    if (loading) {
      this.subject.next(nextResult);
    }
  }

  destroy() {
    if (this.subject) {
      this.subject.complete();
    }

    if (this.subscription) {
      this.subscription.unsubscribe();
    }
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

  const runningRequest = getBackendSrv()
    .fetch<AlertingQueryResponse>(request)
    .pipe(
      map(mapToPanelData(initial)),
      catchError(mapToError(initial)),
      finalize(cancelNetworkRequestsOnUnsubscribe(backendSrv, request)),
      share()
    );

  return merge(timer(200).pipe(mapTo(initial), takeUntil(runningRequest)), runningRequest);
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
): ((response: FetchResponse<AlertingQueryResponse>) => Record<string, PanelData>) => {
  return (response) => {
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
  };
};

const mapToError = (
  dataByQuery: Record<string, PanelData>
): ((err: Error) => Observable<Record<string, PanelData>>) => {
  return (error) => {
    const results: Record<string, PanelData> = {};
    const queryError = toDataQueryError(error);

    for (const [refId, data] of Object.entries(dataByQuery)) {
      results[refId] = {
        ...data,
        state: LoadingState.Error,
        error: queryError,
      };
    }

    return of(results);
  };
};

const cancelNetworkRequestsOnUnsubscribe = (backendSrv: BackendSrv, request: BackendSrvRequest): (() => void) => {
  return () => {
    if (request.requestId) {
      backendSrv.resolveCancelerIfExists(request.requestId);
    }
  };
};

const setStructureRevision = (data: PanelData, lastResult: PanelData) => {
  const result = preProcessPanelData(data, lastResult);
  let structureRev = 1;

  if (lastResult?.structureRev && lastResult.series) {
    structureRev = lastResult.structureRev;
    const sameStructure = compareArrayValues(result.series, lastResult.series, compareDataFrameStructures);
    if (!sameStructure) {
      structureRev++;
    }
  }

  result.structureRev = structureRev;
  return result;
};
