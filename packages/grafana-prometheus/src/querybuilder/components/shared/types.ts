import { DataSourceApi, PanelData } from '@grafana/data';

import { PrometheusDatasource } from '../../../datasource';
import { PromVisualQuery } from '../../types';

export interface NestedQueryProps {
  query: PromVisualQuery;
  datasource: DataSourceApi;
  onChange: (query: PromVisualQuery) => void;
  onRunQuery: () => void;
  showExplain: boolean;
}

export interface QueryBuilderProps {
  query: PromVisualQuery;
  datasource: PrometheusDatasource;
  onChange: (query: PromVisualQuery) => void;
  onRunQuery: () => void;
  data?: PanelData;
  showExplain: boolean;
}
