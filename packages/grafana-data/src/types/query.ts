import { DataQuery as SchemaDataQuery, DataSourceRef as SchemaDataSourceRef } from '@grafana/schema';

/**
 * @deprecated use the type from @grafana/schema
 */
export interface DataQuery extends SchemaDataQuery {}

/**
 * @deprecated use the type from @grafana/schema
 */
export interface DataSourceRef extends SchemaDataSourceRef {}

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
export interface AbstractQuery extends SchemaDataQuery {
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
export interface DataSourceWithQueryImportSupport<TQuery extends SchemaDataQuery> {
  importFromAbstractQueries(labelBasedQuery: AbstractQuery[]): Promise<TQuery[]>;
}

/**
 * @internal
 */
export interface DataSourceWithQueryExportSupport<TQuery extends SchemaDataQuery> {
  exportToAbstractQueries(query: TQuery[]): Promise<AbstractQuery[]>;
}

/**
 * @internal
 */
export const hasQueryImportSupport = <TQuery extends SchemaDataQuery>(
  datasource: unknown
): datasource is DataSourceWithQueryImportSupport<TQuery> => {
  return (datasource as DataSourceWithQueryImportSupport<TQuery>).importFromAbstractQueries !== undefined;
};

/**
 * @internal
 */
export const hasQueryExportSupport = <TQuery extends SchemaDataQuery>(
  datasource: unknown
): datasource is DataSourceWithQueryExportSupport<TQuery> => {
  return (datasource as DataSourceWithQueryExportSupport<TQuery>).exportToAbstractQueries !== undefined;
};
