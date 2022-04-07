import { SelectableValue } from '@grafana/data';

export enum SortOrder {
  Descending = 'Descending',
  Ascending = 'Ascending',
  DatasourceAZ = 'Datasource A-Z',
  DatasourceZA = 'Datasource Z-A',
}

export interface RichHistorySettings {
  retentionPeriod: number;
  starredTabAsFirstTab: boolean;
  activeDatasourceOnly: boolean;
  lastUsedDatasourceFilters: SelectableValue[];
}

export type RichHistorySearchFilters = {
  search: string;
  sortOrder: SortOrder;
  datasourceFilters: SelectableValue[];
  from: number;
  to: number;
};
