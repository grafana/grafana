import { PanelData } from '@grafana/data';

import { PrometheusDatasource } from '../../../datasource';
import { PromVisualQuery } from '../../types';

export interface BaseQueryBuilderProps {
  query: PromVisualQuery;
  datasource: PrometheusDatasource;
  onChange: (update: PromVisualQuery) => void;
  onRunQuery: () => void;
  data?: PanelData;
  showExplain: boolean;
}
