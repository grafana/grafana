import { DataQuery, DataSourceRef } from '@grafana/schema';
import { UserDTO } from 'app/types';

export type QueryTemplateRow = {
  index: string;
  description?: string;
  query?: DataQuery;
  datasourceRef?: DataSourceRef | null;
  datasourceType?: string;
  createdAtTimestamp?: number;
  user?: UserDTO;
};
