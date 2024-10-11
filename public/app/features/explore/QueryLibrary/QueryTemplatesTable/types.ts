import { DataQuery, DataSourceRef } from '@grafana/schema';
import { User } from 'app/features/query-library/types';

export type QueryTemplateRow = {
  index: string;
  datasourceName?: string;
  description?: string;
  query?: DataQuery;
  queryText?: string;
  datasourceRef?: DataSourceRef | null;
  datasourceType?: string;
  createdAtTimestamp?: number;
  user?: User;
  uid?: string;
};
