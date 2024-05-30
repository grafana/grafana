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
  // Number of days
  retentionPeriod: number;
  starredTabAsFirstTab: boolean;
  activeDatasourcesOnly: boolean;
  lastUsedDatasourceFilters?: string[];
}

export type RichHistorySearchFilters = {
  search: string;
  sortOrder: SortOrder;
  /** Names of data sources (not uids) - used by local and remote storage **/
  datasourceFilters: string[];

  // From to correspond to days in the past from now. So from < to but the timeRange this represents is
  // from `now - to` to `now - from`
  from?: number;
  to?: number;

  starred: boolean;
  page?: number;
};
