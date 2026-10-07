import { type DataFrame, type DataQuery, type DataQueryError, type DataTopic } from '@grafana/data';

export interface DashboardQuery extends DataQuery {
  panelId?: number;
  withTransforms?: boolean;
  topic?: DataTopic;
  adHocFiltersEnabled?: boolean;
  /**
   * Tags each series frame with its source: the frame takes this query's refId, and meta.custom gets
   * dashboardSourcePanelId, dashboardSourcePanelTitle and dashboardSourceRefId. The source panel's
   * standard options fill what the frame's fields leave unset.
   */
  withSourceMeta?: boolean;
}

export type ResultInfo = {
  img: string; // The Datasource
  name: string;
  refId: string;
  query: string; // As text
  data: DataFrame[];
  error?: DataQueryError;
};
