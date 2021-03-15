import { Observable } from 'rxjs';
import { DataQuery, DataSourceApi } from './datasource';
import { PanelData } from './panel';
import { ScopedVars } from './ScopedVars';
import { TimeRange, TimeZone } from './time';

export interface QueryRunnerOptions {
  datasource: string | DataSourceApi | null;
  queries: DataQuery[];
  panelId?: number;
  dashboardId?: number;
  timezone: TimeZone;
  timeRange: TimeRange;
  timeInfo?: string; // String description of time range for display
  maxDataPoints: number;
  minInterval: string | undefined | null;
  scopedVars?: ScopedVars;
  cacheTimeout?: string;
  app?: string;
}

export interface QueryRunner {
  get(): Observable<PanelData>;
  run(options: QueryRunnerOptions): Promise<void>;
}
