import { DataQuery, DataSourceRef } from '@grafana/schema';

export type QueryTemplateRow = {
  index: string;
  datasourceName?: string;
  description?: string;
  query?: DataQuery;
  queryText?: string;
  datasourceRef?: DataSourceRef | null;
  datasourceType?: string;
  createdAtTimestamp?: number;
  user?: string;
  uid?: string;
};
