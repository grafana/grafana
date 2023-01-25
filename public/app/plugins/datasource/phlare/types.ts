import { DataSourceJsonData } from '@grafana/data';

import { Phlare as PhlareGen, queryType } from './dataquery.gen';

export interface Query extends PhlareGen {
  queryType: queryType;
}

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
