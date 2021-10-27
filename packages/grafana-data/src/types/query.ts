/**
 * Attached to query results (not persisted)
 *
 * @public
 */
export enum DataTopic {
  Annotations = 'annotations',
}

/**
 * In 8.2, this will become an interface
 *
 * @public
 */
export type DatasourceRef = string;

/**
 * These are the common properties available to all queries in all datasources
 * Specific implementations will *extend* this interface adding the required properties
 * for the given context
 *
 * @public
 */
export interface DataQuery {
  /**
   * A - Z
   */
  refId: string;

  /**
   * true if query is disabled (ie should not be returned to the dashboard)
   */
  hide?: boolean;

  /**
   * Unique, guid like, string used in explore mode
   */
  key?: string;

  /**
   * Specify the query flavor
   */
  queryType?: string;

  /**
   * For mixed data sources the selected datasource is on the query level.
   * For non mixed scenarios this is undefined.
   */
  datasource?: DatasourceRef;
}

export enum LabelComparator {
  Equal = 'Equal',
  NotEqual = 'NotEqual',
  EqualRegEx = 'EqualRegEx',
  NotEqualRegEx = 'NotEqualRegEx',
}

export type LabelSelector = {
  labelName: string;
  labelValue: string;
  labelComparator: LabelComparator;
};

export interface LabelBasedQuery extends DataQuery {
  selectors: LabelSelector[];
}

export interface DataSourceWithQueryImportSupport<TQuery extends DataQuery> {
  toLabelBasedQuery(query: TQuery): LabelBasedQuery;
  fromLabelBasedQuery(labelBasedQuery: LabelBasedQuery): TQuery;
}

/**
 * @internal
 */
export const hasQueryImportSupport = <TQuery extends DataQuery>(
  datasource: any
): datasource is DataSourceWithQueryImportSupport<TQuery> => {
  return (
    (datasource as DataSourceWithQueryImportSupport<TQuery>).toLabelBasedQuery !== undefined &&
    (datasource as DataSourceWithQueryImportSupport<TQuery>).fromLabelBasedQuery !== undefined
  );
};
