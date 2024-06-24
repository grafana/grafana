import { DataQuery, DataSourceRef } from '@grafana/schema';
import { User } from 'app/features/query-library/api/types';

export type QueryTemplateRow = {
  index: string;
  description?: string;
  query?: DataQuery;
  datasourceRef?: DataSourceRef | null;
  datasourceType?: string;
  createdAtTimestamp?: number;
  user?: User;
  uid?: string;
};
