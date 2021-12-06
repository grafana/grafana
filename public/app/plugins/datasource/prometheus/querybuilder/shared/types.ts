/**
 * Shared types that can be reused by Loki and other data sources
 */

export interface QueryBuilderLabelFilter {
  label: string;
  op: string;
  value: string;
}

export interface QueryBuilderOperation {
  id: string;
  params: string[] | number[];
}

export interface QueryWithOperations {
  operations: QueryBuilderOperation[];
}

export interface QueryBuilderOperationDef<T = any> {
  id: string;
  displayName?: string;
  params: QueryBuilderOperationParamDef[];
  defaultParams: string[] | number[];
  category: string;
  renderer: QueryBuilderOperationRenderer;
  addHandler: (operation: QueryBuilderOperationDef, query: T) => T;
}

export type QueryBuilderOperationRenderer = <T = any>(
  model: QueryBuilderOperation,
  def: QueryBuilderOperationDef<T>,
  innerExpr: string
) => string;

export interface QueryBuilderOperationParamDef {
  name: string;
  type: string;
  options?: string[] | number[];
  restParam?: boolean;
  optional?: boolean;
}

export enum QueryEditorMode {
  Builder,
  Code,
}

export interface VisualQueryEngine<T extends QueryWithOperations> {
  getOperationsForCategory(category: string): Array<QueryBuilderOperationDef<T>>;
  getCategories(): string[];
  getOperationDef(id: string): QueryBuilderOperationDef<T>;
}
