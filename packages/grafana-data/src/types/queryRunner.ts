import { type Observable } from 'rxjs';

import { type ScopedVars } from './ScopedVars';
import { type DataSourceApi } from './datasource';
import { type PanelData } from './panel';
import { type DataQuery, type DataSourceRef } from './query';
import { type TimeRange, type TimeZone } from './time';

/**
 * Describes the options used when triggering a query via the {@link QueryRunner}.
 *
 * @internal
 */
export interface QueryRunnerOptions {
  datasource: DataSourceRef | DataSourceApi | null;
  queries: DataQuery[];
  panelId?: number;
  dashboardUID?: string;
  timezone: TimeZone;
  timeRange: TimeRange;
  timeInfo?: string; // String description of time range for display
  maxDataPoints: number;
  minInterval: string | undefined | null;
  scopedVars?: ScopedVars;
  cacheTimeout?: string;
  queryCachingTTL?: number;
  app?: string;
}

/**
 * Describes the QueryRunner that can used to exectue queries in e.g. app plugins.
 * QueryRunner instances can be created via the {@link @grafana/runtime#createQueryRunner | createQueryRunner}.
 *
 * @internal
 */
export interface QueryRunner {
  get(): Observable<PanelData>;
  run(options: QueryRunnerOptions): void;
  cancel(): void;
  destroy(): void;
}
