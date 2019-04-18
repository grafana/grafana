import { DataQuery } from '@grafana/ui/src/types';

export const SHARED_DASHBODARD_QUERY = '-- Dashboard --';

export interface DashboardQuery extends DataQuery {
  panelId?: number;
}
