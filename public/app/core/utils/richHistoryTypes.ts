export enum SortOrder {
  Descending = 'Descending',
  Ascending = 'Ascending',
  /**
   * @deprecated supported only by local storage. It will be removed in the future
   */
  DatasourceAZ = 'Datasource A-Z',
  /**
   * @deprecated supported only by local storage. It will be removed in the future
   */
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
  /** Names of data sources (not uids) - used by local and remote storage **/
  datasourceFilters: string[];
  from: number;
  to: number;
  starred: boolean;
  page?: number;
};
