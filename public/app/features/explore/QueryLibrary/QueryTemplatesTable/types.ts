import { DataQuery, DataSourceRef } from '@grafana/schema';
import { DataQueryFullSpec } from 'app/features/query-library/api/types';

export type QueryTemplateRow = {
  index: string;
  description?: string;
  query?: DataQuery;
  datasourceRef?: DataSourceRef | null;
  datasourceType?: string;
  createdAtTimestamp?: number;
  user?: string;
  uid?: string;
  fullSpec?: DataQueryFullSpec;
};
