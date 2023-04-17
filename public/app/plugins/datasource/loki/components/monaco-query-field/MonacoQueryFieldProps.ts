import { HistoryItem } from '@grafana/data';

import { LokiDatasource } from '../../datasource';
import { LokiQuery } from '../../types';

// we need to store this in a separate file,
// because we have an async-wrapper around,
// the react-component, and it needs the same
// props as the sync-component.
export type Props = {
  initialValue: string;
  history: Array<HistoryItem<LokiQuery>>;
  onRunQuery: (value: string) => void;
  onBlur: (value: string) => void;
  placeholder: string;
  datasource: LokiDatasource;
  onQueryType?: (query: string) => void;
};
