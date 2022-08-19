import { cloneDeep } from 'lodash';
// import { Unsubscribable } from 'rxjs';

import {
  CoreApp,
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  DataSourceRef,
  rangeUtil,
  ScopedVars,
  TimeRange,
} from '@grafana/data';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getNextRequestId } from 'app/features/query/state/PanelQueryRunner';
import { runRequest } from 'app/features/query/state/runRequest';

export interface QueryRunnerState {
  queries: DataQueryExtended[];
}

export interface DataQueryExtended extends DataQuery {
  [key: string]: any;
}

export class SceneQueryRunner {
  private queries: DataQueryExtended[];

  constructor(state: QueryRunnerState) {
    this.queries = state.queries;
  }

  updateQueries(queries: DataQueryExtended[]) {
    this.queries = queries;
  }

  async runWithTimeRange(timeRange: TimeRange) {
    const queries = cloneDeep(this.queries);

    const request: DataQueryRequest = {
      app: CoreApp.Dashboard,
      requestId: getNextRequestId(),
      timezone: 'browser',
      panelId: 1,
      dashboardId: 1,
      range: timeRange,
      interval: '1s',
      intervalMs: 1000,
      targets: cloneDeep(this.queries),
      maxDataPoints: 500,
      scopedVars: {},
      startTime: Date.now(),
    };

    try {
      const ds = await getDataSource(queries[0].datasource!, request.scopedVars);

      // Attach the data source name to each query
      request.targets = request.targets.map((query) => {
        if (!query.datasource) {
          query.datasource = ds.getRef();
        }
        return query;
      });

      const lowerIntervalLimit = ds.interval;
      const norm = rangeUtil.calculateInterval(timeRange, request.maxDataPoints ?? 1000, lowerIntervalLimit);

      // make shallow copy of scoped vars,
      // and add built in variables interval and interval_ms
      request.scopedVars = Object.assign({}, request.scopedVars, {
        __interval: { text: norm.interval, value: norm.interval },
        __interval_ms: { text: norm.intervalMs.toString(), value: norm.intervalMs },
      });

      request.interval = norm.interval;
      request.intervalMs = norm.intervalMs;

      return runRequest(ds, request);
    } catch (err) {
      console.error('PanelQueryRunner Error', err);
    }
  }
}

async function getDataSource(
  datasource: DataSourceRef | string | DataSourceApi | null,
  scopedVars: ScopedVars
): Promise<DataSourceApi> {
  if (datasource && (datasource as any).query) {
    return datasource as DataSourceApi;
  }
  return await getDatasourceSrv().get(datasource as string, scopedVars);
}
