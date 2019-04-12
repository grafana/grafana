import DatasourceSrv from 'app/features/plugins/datasource_srv';
import { Subject } from 'rxjs';
import {
  guessFieldTypes,
  toSeriesData,
  QueryResponseData,
  LoadingState,
  DataQuery,
  TimeRange,
  ScopedVars,
  QueryRequestInfo,
  SeriesData,
  LegacyResponseData,
  DataQueryError,
  toLegacyResponseData,
  isSeriesData,
} from '@grafana/ui';

import kbn from 'app/core/utils/kbn';

/**
 * Query response may come as events. any null|missing value just means
 * that is unknown info in the request
 */
export interface QueryResponseEvent extends Partial<QueryResponseData> {
  eventId: number;
}

export interface QueryRunnerOptions {
  datasource: string | null;
  queries: DataQuery[];
  panelId: number;
  dashboardId?: number;
  timeRange?: TimeRange;
  widthPixels: number;
  minInterval?: string;
  maxDataPoints?: number;
  scopedVars?: ScopedVars;
}

export class PanelQueryRunner extends Subject<QueryResponseEvent> {
  private counter = 0;

  includeLegacyFormats = false;

  constructor(private dataSourceSrv: DatasourceSrv) {
    super();
  }

  async run(options: QueryRunnerOptions) {
    const { queries, datasource, panelId, dashboardId, timeRange, widthPixels, maxDataPoints, scopedVars } = options;

    const request: QueryRequestInfo = {
      timezone: 'browser',
      panelId: panelId,
      dashboardId: dashboardId,
      range: timeRange,
      rangeRaw: timeRange.raw,
      interval: '',
      intervalMs: 0,
      targets: queries,
      maxDataPoints: maxDataPoints || widthPixels,
      scopedVars: scopedVars || {},
      cacheTimeout: null,
      startTime: Date.now(),
    };

    if (!queries) {
      this.next({
        eventId: this.counter++,
        loading: LoadingState.Done,
        data: [], // Clear the data
        legacy: [],
        request,
      });
      return;
    }

    try {
      const ds = await this.dataSourceSrv.get(datasource, scopedVars);

      // TODO interpolate variables
      const minInterval = options.minInterval || ds.interval;
      const intervalRes = kbn.calculateInterval(timeRange, widthPixels, minInterval);
      request.interval = intervalRes.interval;
      request.intervalMs = intervalRes.intervalMs;

      // Start loading spinner
      this.next({
        eventId: this.counter++,
        loading: LoadingState.Loading,
        request,
      });

      const resp = await ds.query(request);
      request.finishTime = Date.now();

      // Make sure the data is SeriesData[]
      let legacy: LegacyResponseData[] | undefined;
      const data = getProcessedSeriesData(resp.data);
      if (this.includeLegacyFormats) {
        legacy = resp.data.map(v => {
          if (isSeriesData(v)) {
            return toLegacyResponseData(v);
          }
          return v;
        });
      }

      // Start loading spinner
      this.next({
        eventId: this.counter++,
        loading: LoadingState.Done,
        request,
        data,
        legacy,
      });
    } catch (err) {
      request.finishTime = Date.now();

      const error = err as DataQueryError;
      if (!error.message) {
        err.message = 'Query Error';
      }

      this.next({
        eventId: this.counter++,
        loading: LoadingState.Error,
        error: error,
        request,
      });
    }
  }
}

/**
 * All panels will be passed tables that have our best guess at colum type set
 *
 * This is also used by PanelChrome for snapshot support
 */
export function getProcessedSeriesData(results?: any[]): SeriesData[] {
  if (!results) {
    return [];
  }

  const series: SeriesData[] = [];
  for (const r of results) {
    if (r) {
      series.push(guessFieldTypes(toSeriesData(r)));
    }
  }
  return series;
}
