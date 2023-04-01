import { DataFrame, DataQuery, DataQueryError, DataTopic } from '@grafana/data';

export const SHARED_DASHBOARD_QUERY = '-- Dashboard --';
export const DASHBOARD_DATASOURCE_PLUGIN_ID = 'dashboard';

export interface DashboardQuery extends DataQuery {
  panelId?: number;
  withTransforms?: boolean;
  topic?: DataTopic;
}

export type ResultInfo = {
  img: string; // The Datasource
  refId: string;
  query: string; // As text
  data: DataFrame[];
  error?: DataQueryError;
};
