import { DataQuery, DataSourceRef } from '@grafana/schema';
export type { DataQuery, DataSourceRef };

/**
 * Attached to query results (not persisted)
 *
 * @public
 */
export enum DataTopic {
  Annotations = 'annotations',
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
