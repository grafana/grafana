/**
 * Shared types that can be reused by Loki and other data sources
 */

import { DataSourceApi, RegistryItem, SelectableValue } from '@grafana/data';
import { ComponentType } from 'react';

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

export interface QueryBuilderOperationDef<T = any> extends RegistryItem {
  documentation?: string;
  params: QueryBuilderOperationParamDef[];
  defaultParams: QueryBuilderOperationParamValue[];
  category: string;
  hideFromList?: boolean;
  alternativesKey?: string;
  renderer: QueryBuilderOperationRenderer;
  addOperationHandler: QueryBuilderAddOperationHandler<T>;
  paramChangedHandler?: QueryBuilderOnParamChangedHandler;
  explainHandler?: (op: QueryBuilderOperation, def: QueryBuilderOperationDef<T>) => string;
  changeTypeHandler?: (op: QueryBuilderOperation, newDef: QueryBuilderOperationDef<T>) => QueryBuilderOperation;
}

export type QueryBuilderAddOperationHandler<T> = (
  def: QueryBuilderOperationDef,
  query: T,
  modeller: VisualQueryModeller
) => T;

export type QueryBuilderOnParamChangedHandler = (
  index: number,
  operation: QueryBuilderOperation,
  operationDef: QueryBuilderOperationDef
) => QueryBuilderOperation;

export type QueryBuilderOperationRenderer = (
  model: QueryBuilderOperation,
  def: QueryBuilderOperationDef,
  innerExpr: string
) => string;

export type QueryBuilderOperationParamValue = string | number;

export interface QueryBuilderOperationParamDef {
  name: string;
  type: string;
  options?: string[] | number[] | Array<SelectableValue<string>>;
  restParam?: boolean;
  optional?: boolean;
  editor?: ComponentType<QueryBuilderOperationParamEditorProps>;
}

export interface QueryBuilderOperationEditorProps {
  operation: QueryBuilderOperation;
  index: number;
  query: any;
  datasource: DataSourceApi;
  queryModeller: VisualQueryModeller;
  onChange: (index: number, update: QueryBuilderOperation) => void;
  onRemove: (index: number) => void;
}

export interface QueryBuilderOperationParamEditorProps {
  value?: QueryBuilderOperationParamValue;
  paramDef: QueryBuilderOperationParamDef;
  /** Parameter index */
  index: number;
  operation: QueryBuilderOperation;
  operationIndex: number;
  query: any;
  datasource: DataSourceApi;
  onChange: (index: number, value: QueryBuilderOperationParamValue) => void;
  onRunQuery: () => void;
}

export enum QueryEditorMode {
  Builder,
  Code,
  Explain,
}

export interface VisualQueryModeller {
  getOperationsForCategory(category: string): QueryBuilderOperationDef[];
  getAlternativeOperations(key: string): QueryBuilderOperationDef[];
  getCategories(): string[];
  getOperationDef(id: string): QueryBuilderOperationDef;
}
