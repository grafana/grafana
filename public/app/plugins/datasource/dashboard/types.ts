import { type DataFrame } from '@grafana/data/dataframe';
import type { DataQuery, DataQueryError, DataTopic } from '@grafana/data/types';

export interface DashboardQuery extends DataQuery {
  panelId?: number;
  withTransforms?: boolean;
  topic?: DataTopic;
  adHocFiltersEnabled?: boolean;
}

export type ResultInfo = {
  img: string; // The Datasource
  name: string;
  refId: string;
  query: string; // As text
  data: DataFrame[];
  error?: DataQueryError;
};
