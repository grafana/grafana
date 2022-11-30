import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface Query extends DataQuery {
  labelSelector: string;
  profileTypeId: string;
  queryType: 'metrics' | 'profile' | 'both';
  groupBy: string[];
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

export const defaultQuery: Partial<Query> = {
  labelSelector: '{}',
  queryType: 'both',
  groupBy: [],
};

/**
 * These are options configured for each DataSource instance.
 */
export interface FireDataSourceOptions extends DataSourceJsonData {
  minStep?: string;
}
