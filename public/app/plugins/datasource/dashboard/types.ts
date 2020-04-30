import { DataQuery } from '@grafana/data';

export const SHARED_DASHBOARD_QUERY = '-- Dashboard --';

export interface DashboardQuery extends DataQuery {
  panelId?: number;
}
