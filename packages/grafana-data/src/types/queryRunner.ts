import { Observable } from 'rxjs';
import { DataQuery, DataSourceApi, DataSourceJsonData } from './datasource';
import { PanelData } from './panel';
import { ScopedVars } from './ScopedVars';
import { TimeRange, TimeZone } from './time';
import { DataTransformerConfig } from './transformations';

/**
 * Describes the options being passed to {@link QueryRunner.run} when running a query against any of the
 * supported datasource plugins.
 *
 * @alpha
 */
export interface QueryRunnerOptions<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> {
  datasource: string | DataSourceApi<TQuery, TOptions> | null;
  queries: TQuery[];
  panelId?: number;
  dashboardId?: number;
  timezone: TimeZone;
  timeRange: TimeRange;
  timeInfo?: string; // String description of time range for display
  maxDataPoints: number;
  minInterval: string | undefined | null;
  scopedVars?: ScopedVars;
  cacheTimeout?: string;
  delayStateNotification?: number; // default 100ms.
  transformations?: DataTransformerConfig[];
}

/**
 * Describes the options being passed to {@link QueryRunner.getData} when fetching
 * data for a query.
 *
 * @alpha
 */
export interface QueryRunnerGetDataOptions {
  withTransforms: boolean;
  withFieldConfig: boolean;
}

/**
 * Describes the QueryRunner that can be used to run queries against any of the
 * supported datasource plugins installed on the current Grafana instance.
 *
 * @alpha
 */
export interface QueryRunner {
  getData(options: QueryRunnerGetDataOptions): Observable<PanelData>;
  run(options: QueryRunnerOptions): Promise<void>;
  cancelQuery(): void;
  destroy(): void;
}
