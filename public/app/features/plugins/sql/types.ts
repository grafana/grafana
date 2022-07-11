import { JsonTree } from 'react-awesome-query-builder';

import {
  AnnotationEvent,
  DataFrame,
  DataQuery,
  DataSourceJsonData,
  MetricFindValue,
  SelectableValue,
  TimeRange,
  toOption as toOptionFromData,
} from '@grafana/data';
import { CompletionItemKind, EditorMode, LanguageCompletionProvider } from '@grafana/experimental';
import { BackendDataSourceResponse } from '@grafana/runtime';

import { QueryWithDefaults } from './defaults';
import {
  QueryEditorFunctionExpression,
  QueryEditorGroupByExpression,
  QueryEditorPropertyExpression,
} from './expressions';

export interface SqlQueryForInterpolation {
  dataset?: string;
  alias?: string;
  format?: ResultFormat;
  rawSql?: string;
  refId: string;
  hide?: boolean;
}

export interface SQLOptions extends DataSourceJsonData {
  timeInterval: string;
  database: string;
}

export type ResultFormat = 'time_series' | 'table';

export enum QueryFormat {
  Timeseries = 'time_series',
  Table = 'table',
}

export interface SQLQuery extends DataQuery {
  alias?: string;
  format?: ResultFormat | QueryFormat | string | undefined;
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
  dsID: () => string;
  dispose?: (dsID?: string) => void;
  lookup: (path?: string) => Promise<Array<{ name: string; completion: string }>>;
  getSqlCompletionProvider: () => LanguageCompletionProvider;
  toRawSql?: (query: SQLQuery) => string;
}

export interface QueryEditorProps {
  db: DB;
  query: QueryWithDefaults;
  onChange: (query: SQLQuery) => void;
  range?: TimeRange;
}

export interface ValidationResults {
  query: SQLQuery;
  rawSql: string;
  error: string;
  isError: boolean;
  isValid: boolean;
  statistics?: {
    TotalBytesProcessed: number;
  } | null;
}

export interface SqlQueryModel {
  interpolate: () => string;
  quoteLiteral: (v: string) => string;
}

export interface ResponseParser {
  transformAnnotationResponse: (options: object, data: BackendDataSourceResponse) => Promise<AnnotationEvent[]>;
  transformMetricFindResponse: (frame: DataFrame) => MetricFindValue[];
}

export interface MetaDefinition {
  name: string;
  completion?: string;
  kind: CompletionItemKind;
}
