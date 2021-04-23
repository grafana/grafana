import { GrafanaQuery } from '../../../types/unified-alerting-dto';
import { getBackendSrv } from '../../../core/services/backend_srv';
import { BackendSrvRequest, FetchResponse } from '../../../../../packages/grafana-runtime';
import { dataFrameFromJSON, DataFrameJSON, dateMath, LoadingState, PanelData } from '@grafana/data';
import { catchError, finalize, map, mapTo, share, takeUntil } from 'rxjs/operators';
import { merge, Observable, of, ReplaySubject, timer, Unsubscribable } from 'rxjs';

interface AlertingQueryResult {
  frames: DataFrameJSON[];
}

interface AlertingQueryResponse {
  results: Record<string, AlertingQueryResult>;
}
export class AlertingQueryRunner {
  private subject: ReplaySubject<Record<string, PanelData>>;
  private subscription?: Unsubscribable;
  private lastResult?: PanelData;

  constructor() {
    this.subject = new ReplaySubject(1);
  }

  get(): Observable<Record<string, PanelData>> {
    return this.subject.asObservable();
  }

  async run(queries: GrafanaQuery[]) {
    if (queries.length === 0) {
      // emit empty data.
    }
    this.subscription = runRequest(queries).subscribe({
      next: (data) => {
        this.subject.next(data);

        // const results = preProcessPanelData(data, this.lastResult);
        // // Indicate if the structure has changed since the last query
        // let structureRev = 1;
        // if (this.lastResult?.structureRev && this.lastResult.series) {
        //   structureRev = this.lastResult.structureRev;
        //   const sameStructure = compareArrayValues(results.series, this.lastResult.series, compareDataFrameStructures);
        //   if (!sameStructure) {
        //     structureRev++;
        //   }
        // }
        // results.structureRev = structureRev;
        // this.lastResult = results;

        // // Store preprocessed query results for applying overrides later on in the pipeline
        // this.subject.next(this.lastResult);
      },
      error: (error) => console.error('PanelQueryRunner Error', error),
    });
  }

  cancel() {}
}

const runRequest = (queries: GrafanaQuery[]): Observable<Record<string, PanelData>> => {
  const loading = loadingState(queries);
  const request = {
    data: {
      data: queries,
    },
    url: '/api/v1/eval',
    method: 'POST',
  };

  const runningRequest = getBackendSrv()
    .fetch<AlertingQueryResponse>(request)
    .pipe(
      map(mapResponseToPanelData),
      catchError((error) => of(errorState(queries, error))),
      finalize(cancelNetworkRequestsOnUnsubscribe(request)),
      // this makes it possible to share this observable in takeUntil
      share()
    );

  return merge(timer(200).pipe(mapTo(loading), takeUntil(runningRequest)), runningRequest);
};

const errorState = (queries: GrafanaQuery[], error: Error): Record<string, PanelData> => {
  return queries.reduce((state, query) => {
    state[query.refId] = {
      state: LoadingState.Error,
      series: [],
      timeRange: {
        from: dateMath.parse('now-6h')!,
        to: dateMath.parse('now')!,
        raw: {
          from: 'now-6h',
          to: 'now',
        },
      },
    };

    return state;
  }, {} as Record<string, PanelData>);
};

const loadingState = (queries: GrafanaQuery[]): Record<string, PanelData> => {
  return queries.reduce((state, query) => {
    state[query.refId] = {
      state: LoadingState.Loading,
      series: [],
      timeRange: {
        from: dateMath.parse('now-6h')!,
        to: dateMath.parse('now')!,
        raw: {
          from: 'now-6h',
          to: 'now',
        },
      },
    };

    return state;
  }, {} as Record<string, PanelData>);
};

const mapResponseToPanelData = (response: FetchResponse<AlertingQueryResponse>): Record<string, PanelData> => {
  const { results } = response.data;
  const dataByRefId: Record<string, PanelData> = {};

  for (const [refId, result] of Object.entries(results)) {
    dataByRefId[refId] = {
      timeRange: {
        from: dateMath.parse('now-6h')!,
        to: dateMath.parse('now')!,
        raw: {
          from: 'now-6h',
          to: 'now',
        },
      },
      state: LoadingState.Done,
      series: result.frames.map(dataFrameFromJSON),
    };
  }

  return dataByRefId;
};

function cancelNetworkRequestsOnUnsubscribe(request: BackendSrvRequest) {
  return () => {
    if (request.requestId) {
      getBackendSrv().resolveCancelerIfExists(request.requestId);
    }
  };
}
