import { Observable } from 'rxjs';
import { DataQuery, DataSourceApi, DataSourceJsonData } from './datasource';
import { PanelData } from './panel';
import { ScopedVars } from './ScopedVars';
import { TimeRange, TimeZone } from './time';
import { DataTransformerConfig } from './transformations';

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

export interface GetDataOptions {
  withTransforms: boolean;
  withFieldConfig: boolean;
}

export interface QueryRunner {
  getData(options: GetDataOptions): Observable<PanelData>;
  run(options: QueryRunnerOptions): Promise<void>;
  cancelQuery(): void;
  resendLastResult(): void;
  destroy(): void;
  useLastResultFrom(runner: QueryRunner): void;
  getLastResult(): PanelData | undefined;
}
