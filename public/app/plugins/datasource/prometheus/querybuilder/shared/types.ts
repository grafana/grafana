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
  params: QueryBuilderOperationParamValue[];
}

export interface QueryWithOperations {
  operations: QueryBuilderOperation[];
}

export interface QueryBuilderOperationDef<T = any> {
  id: string;
  displayName?: string;
  params: QueryBuilderOperationParamDef[];
  defaultParams: QueryBuilderOperationParamValue[];
  category: string;
  renderer: QueryBuilderOperationRenderer;
  addHandler: (operation: QueryBuilderOperationDef, query: T) => T;
}

export type QueryBuilderOperationRenderer = (
  model: QueryBuilderOperation,
  def: QueryBuilderOperationDef,
  innerExpr: string
) => string;

export type QueryBuilderOperationParamValue = string | number;

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

export interface VisualQueryModeller {
  getOperationsForCategory(category: string): QueryBuilderOperationDef[];
  getCategories(): string[];
  getOperationDef(id: string): QueryBuilderOperationDef;
}
