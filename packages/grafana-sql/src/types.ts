import { JsonTree } from '@react-awesome-query-builder/ui';

import {
  DataFrame,
  DataQuery,
  DataSourceJsonData,
  MetricFindValue,
  SelectableValue,
  TimeRange,
  toOption as toOptionFromData,
} from '@grafana/data';
import { CompletionItemKind, EditorMode, LanguageDefinition } from '@grafana/plugin-ui';

import { QueryWithDefaults } from './defaults';
import {
  QueryEditorFunctionExpression,
  QueryEditorGroupByExpression,
  QueryEditorPropertyExpression,
} from './expressions';

export interface SqlQueryForInterpolation {
  dataset?: string;
  alias?: string;
  format?: QueryFormat;
  rawSql?: string;
  refId: string;
  hide?: boolean;
}

export interface SQLConnectionLimits {
  maxOpenConns: number;
  maxIdleConns: number;
  maxIdleConnsAuto: boolean;
  connMaxLifetime: number;
}

export interface SQLOptions extends SQLConnectionLimits, DataSourceJsonData {
  tlsAuth: boolean;
  tlsAuthWithCACert: boolean;
  timezone: string;
  tlsSkipVerify: boolean;
  user: string;
  database: string;
  url: string;
  timeInterval: string;
}

export enum QueryFormat {
  Timeseries = 'time_series',
  Table = 'table',
}

export interface SQLQuery extends DataQuery {
  alias?: string;
  format?: QueryFormat;
  rawSql?: string;
  dataset?: string;
  table?: string;
  sql?: SQLExpression;
  editorMode?: EditorMode;
  rawQuery?: boolean;
}

export interface NameValue {
  name: string;
  value: string;
}

export type SQLFilters = NameValue[];

export interface SQLExpression {
  columns?: QueryEditorFunctionExpression[];
  whereJsonTree?: JsonTree;
  whereString?: string;
  filters?: SQLFilters;
  groupBy?: QueryEditorGroupByExpression[];
  orderBy?: QueryEditorPropertyExpression;
  orderByDirection?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface TableSchema {
  name?: string;
  schema?: TableFieldSchema[];
}

export interface TableFieldSchema {
  name: string;
  description?: string;
  type: string;
  repeated: boolean;
  schema: TableFieldSchema[];
}

export interface QueryRowFilter {
  filter: boolean;
  group: boolean;
  order: boolean;
  preview: boolean;
}

export const QUERY_FORMAT_OPTIONS = [
  { label: 'Time series', value: QueryFormat.Timeseries },
  { label: 'Table', value: QueryFormat.Table },
];

const backWardToOption = (value: string) => ({ label: value, value });

export const toOption = toOptionFromData ?? backWardToOption;

export interface ResourceSelectorProps {
  disabled?: boolean;
  className?: string;
  applyDefault?: boolean;
}
// React Awesome Query builder field types.
// These are responsible for rendering the correct UI for the field.
export type RAQBFieldTypes = 'text' | 'number' | 'boolean' | 'datetime' | 'date' | 'time';

export interface SQLSelectableValue extends SelectableValue {
  type?: string;
  raqbFieldType?: RAQBFieldTypes;
}

export interface DB {
  init?: (datasourceId?: string) => Promise<boolean>;
  datasets: () => Promise<string[]>;
  tables: (dataset?: string) => Promise<string[]>;
  fields: (query: SQLQuery, order?: boolean) => Promise<SQLSelectableValue[]>;
  validateQuery: (query: SQLQuery, range?: TimeRange) => Promise<ValidationResults>;
  dsID: () => number;
  dispose?: (dsID?: string) => void;
  lookup?: (path?: string) => Promise<Array<{ name: string; completion: string }>>;
  getEditorLanguageDefinition: () => LanguageDefinition;
  toRawSql: (query: SQLQuery) => string;
  functions: () => Func[];
}

export interface FuncParameter {
  name: string;
  required?: boolean;
  options?: (query: SQLQuery) => Promise<SelectableValue[]>;
}
export interface Func {
  name: string;
  parameters?: FuncParameter[];
  description?: string;
}

export interface QueryEditorProps {
  db: DB;
  query: QueryWithDefaults;
  onChange: (query: SQLQuery) => void;
  range?: TimeRange;
}

export interface ValidationResults {
  query: SQLQuery;
  rawSql?: string;
  error: string;
  isError: boolean;
  isValid: boolean;
  statistics?: {
    TotalBytesProcessed: number;
  } | null;
}

export interface SqlQueryModel {
  quoteLiteral: (v: string) => string;
}

export interface ResponseParser {
  transformMetricFindResponse: (frame: DataFrame) => MetricFindValue[];
}

export interface MetaDefinition {
  name: string;
  completion?: string;
  kind: CompletionItemKind;
}

export type SQLDialect = 'postgres' | 'influx' | 'other';
