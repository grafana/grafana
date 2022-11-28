/**
 * Attached to query results (not persisted)
 *
 * @public
 */
export enum DataTopic {
  Annotations = 'annotations',
}

/**
 * @public
 */
export interface DataSourceRef {
  /** The plugin type-id */
  type?: string;

  /** Specific datasource instance */
  uid?: string;
}

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
  datasource?: DataSourceRef | null;
}

/**
 * Abstract representation of any label-based query
 * @internal
 */
export interface AbstractQuery extends DataQuery {
  labelMatchers: AbstractLabelMatcher[];
}

/**
 * @internal
 */
export enum AbstractLabelOperator {
  Equal = 'Equal',
  NotEqual = 'NotEqual',
  EqualRegEx = 'EqualRegEx',
  NotEqualRegEx = 'NotEqualRegEx',
}

/**
 * @internal
 */
export type AbstractLabelMatcher = {
  name: string;
  value: string;
  operator: AbstractLabelOperator;
};

/**
 * @internal
 */
export interface DataSourceWithQueryImportSupport<TQuery extends DataQuery> {
  importFromAbstractQueries(labelBasedQuery: AbstractQuery[]): Promise<TQuery[]>;
}

/**
 * @internal
 */
export interface DataSourceWithQueryExportSupport<TQuery extends DataQuery> {
  exportToAbstractQueries(query: TQuery[]): Promise<AbstractQuery[]>;
}

/**
 * @internal
 */
export const hasQueryImportSupport = <TQuery extends DataQuery>(
  datasource: unknown
): datasource is DataSourceWithQueryImportSupport<TQuery> => {
  return (datasource as DataSourceWithQueryImportSupport<TQuery>).importFromAbstractQueries !== undefined;
};

/**
 * @internal
 */
export const hasQueryExportSupport = <TQuery extends DataQuery>(
  datasource: unknown
): datasource is DataSourceWithQueryExportSupport<TQuery> => {
  return (datasource as DataSourceWithQueryExportSupport<TQuery>).exportToAbstractQueries !== undefined;
};
