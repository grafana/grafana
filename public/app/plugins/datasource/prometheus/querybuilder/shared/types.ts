/**
 * Shared types that can be reused by Loki and other data sources
 */

import { ComponentType } from 'react';

import { DataSourceApi, RegistryItem, SelectableValue } from '@grafana/data';

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
  /** Can be used to control operation placement when adding a new operations, lower are placed first */
  orderRank?: number;
  renderer: QueryBuilderOperationRenderer;
  addOperationHandler: QueryBuilderAddOperationHandler<T>;
  paramChangedHandler?: QueryBuilderOnParamChangedHandler;
  explainHandler?: QueryBuilderExplainOperationHandler;
  changeTypeHandler?: (op: QueryBuilderOperation, newDef: QueryBuilderOperationDef<T>) => QueryBuilderOperation;
}

export type QueryBuilderAddOperationHandler<T> = (
  def: QueryBuilderOperationDef,
  query: T,
  modeller: VisualQueryModeller
) => T;

export type QueryBuilderExplainOperationHandler = (op: QueryBuilderOperation, def?: QueryBuilderOperationDef) => string;

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

export type QueryBuilderOperationParamValue = string | number | boolean;

export interface QueryBuilderOperationParamDef {
  name: string;
  type: 'string' | 'number' | 'boolean';
  options?: string[] | number[] | Array<SelectableValue<string>>;
  hideName?: boolean;
  restParam?: boolean;
  optional?: boolean;
  placeholder?: string;
  description?: string;
  minWidth?: number;
  editor?: ComponentType<QueryBuilderOperationParamEditorProps>;
  runQueryOnEnter?: boolean;
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
  Code = 'code',
  Builder = 'builder',
}

export interface VisualQueryModeller {
  getOperationsForCategory(category: string): QueryBuilderOperationDef[];
  getAlternativeOperations(key: string): QueryBuilderOperationDef[];
  getCategories(): string[];
  getOperationDef(id: string): QueryBuilderOperationDef | undefined;
}
