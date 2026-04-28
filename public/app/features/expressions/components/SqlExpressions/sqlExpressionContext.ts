import { type DataQuery } from '@grafana/schema';

export interface QueryUsageContext {
  panelId?: string;
  alerting?: boolean;
  queries?: DataQuery[];
  dashboardContext?: {
    dashboardTitle?: string;
    panelName?: string;
  };
  datasources?: string[];
  totalRows?: number;
  requestTime?: number;
  numberOfQueries?: number;
}
