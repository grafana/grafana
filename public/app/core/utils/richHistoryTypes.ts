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
  // from and to represent number of days from now to filter by as the front end filtering is designed that way.
  // so the resulting timerange from this will be [now - from, now - to].
  from?: number;
  to?: number;
  starred: boolean;
  page?: number;
};

export type RichHistorySearchBackendFilters = Omit<RichHistorySearchFilters, 'from' | 'to'> & {
  // This seems pointless but it serves as a documentation because we convert the filters from meaning days from now to
  // mean absolute timestamps for the history backends.
  from?: number;
  to?: number;
};
