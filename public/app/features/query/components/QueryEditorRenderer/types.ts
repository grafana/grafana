import { CoreApp, DataQuery, DataSourceApi, PanelData, TimeRange } from '@grafana/data';

export interface EditorRendererProps {
  dataSource: DataSourceApi;
  timeRange?: TimeRange;
  onChange: (query: DataQuery) => void;
  onRunQuery: () => void;
  query: DataQuery;
  queries: DataQuery[];
  data?: PanelData;
  app?: CoreApp;
}
