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
  lastUsedDatasourceFilters: string[];
}

export type RichHistorySearchFilters = {
  search: string;
  sortOrder: SortOrder;
  datasourceFilters: string[];
  from: number;
  to: number;
  starred: boolean;
};
