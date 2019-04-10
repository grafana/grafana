import { DataQuery } from '@grafana/ui/src/types';

export interface DashboardQuery extends DataQuery {
  panelId?: number;
}
