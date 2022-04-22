export enum SortOrder {
  Descending = 'Descending',
  Ascending = 'Ascending',
  // PLAN 2: remote storage won't support it. make it deprecated. make the api return list of supported settings?
  DatasourceAZ = 'Datasource A-Z',
  DatasourceZA = 'Datasource Z-A',
}

export interface RichHistorySettings {
  retentionPeriod: number;
  starredTabAsFirstTab: boolean;
  activeDatasourceOnly: boolean;
  lastUsedDatasourceFilters?: string[];
}

export type RichHistorySearchFilters = {
  search: string;
  sortOrder: SortOrder;
  datasourceFilters: string[];
  from: number;
  to: number;
  starred: boolean;
};
