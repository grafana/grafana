import { DataQuery, DataSourceRef } from '@grafana/schema';

export type QueryTemplateRow = {
  index: string;
  description?: string;
  query?: DataQuery;
  queryText?: string;
  datasourceRef?: DataSourceRef | null;
  datasourceType?: string;
  createdAtTimestamp?: number;
  user?: string;
  uid?: string;
};
