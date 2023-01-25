import { DataSourceJsonData } from '@grafana/data';

// export type { QueryType, Phlare as Query } from './dataquery.gen';
import { Phlare as Query } from './dataquery.gen';
export type { Query };

export interface ProfileTypeMessage {
  ID: string;
  name: string;
  period_type: string;
  period_unit: string;
  sample_type: string;
  sample_unit: string;
}

export type SeriesMessage = Array<{ labels: Array<{ name: string; value: string }> }>;

/**
 * These are options configured for each DataSource instance.
 */
export interface PhlareDataSourceOptions extends DataSourceJsonData {
  minStep?: string;
}
