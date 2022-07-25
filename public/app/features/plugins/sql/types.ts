import { JsonTree } from 'react-awesome-query-builder';

import {
  DataFrame,
  DataQuery,
  DataSourceJsonData,
  MetricFindValue,
  SelectableValue,
  TimeRange,
  toOption as toOptionFromData,
} from '@grafana/data';
import { Monaco, monacoTypes } from '@grafana/ui';

import { QueryWithDefaults } from './defaults';
import {
  QueryEditorFunctionExpression,
  QueryEditorGroupByExpression,
  QueryEditorPropertyExpression,
} from './expressions';
import { StatementPositionResolver, SuggestionsResolver } from './standardSql/types';
import { LinkedToken } from './utils/LinkedToken';

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

export enum EditorMode {
  Builder = 'builder',
  Code = 'code',
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

export interface Aggregate {
  id: string;
  name: string;
  description?: string;
}

export interface DB {
  init?: (datasourceId?: string) => Promise<boolean>;
  datasets: () => Promise<string[]>;
  tables: (dataset?: string) => Promise<string[]>;
  fields: (query: SQLQuery, order?: boolean) => Promise<SQLSelectableValue[]>;
  validateQuery: (query: SQLQuery, range?: TimeRange) => Promise<ValidationResults>;
  dsID: () => number;
  dispose?: (dsID?: string) => void;
  lookup: (path?: string) => Promise<Array<{ name: string; completion: string }>>;
  getSqlCompletionProvider: () => LanguageCompletionProvider;
  toRawSql?: (query: SQLQuery) => string;
  functions: () => Promise<Aggregate[]>;
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
  interpolate: () => string;
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

/**
 * Provides a context for suggestions resolver
 * @alpha
 */
export interface PositionContext {
  position: monacoTypes.IPosition;
  kind: SuggestionKind[];
  statementPosition: StatementPosition[];
  currentToken: LinkedToken | null;
  range: monacoTypes.IRange;
}

export type CustomSuggestion = Partial<monacoTypes.languages.CompletionItem> & { label: string };

export interface CustomSuggestionKind {
  id: string;
  suggestionsResolver: SuggestionsResolver;
  applyTo?: Array<StatementPosition | string>;
  overrideDefault?: boolean;
}

export interface CustomStatementPlacement {
  id: string;
  name?: string;
  resolve: StatementPositionResolver;
  overrideDefault?: boolean;
}
export type StatementPlacementProvider = () => CustomStatementPlacement[];
export type SuggestionKindProvider = () => CustomSuggestionKind[];

export interface ColumnDefinition {
  name: string;
  type?: string;
  description?: string;
  // Text used for automplete. If not provided name is used.
  completion?: string;
}
export interface TableDefinition {
  name: string;
  // Text used for automplete. If not provided name is used.
  completion?: string;
}

export interface SQLCompletionItemProvider
  extends Omit<monacoTypes.languages.CompletionItemProvider, 'provideCompletionItems'> {
  /**
   * Allows dialect specific functions to be added to the completion list.
   * @alpha
   */
  supportedFunctions?: () => Array<{
    id: string;
    name: string;
    description?: string;
  }>;

  /**
   * Allows dialect specific operators to be added to the completion list.
   * @alpha
   */
  supportedOperators?: () => Array<{
    id: string;
    operator: string;
    type: OperatorType;
    description?: string;
  }>;

  supportedMacros?: () => Array<{
    id: string;
    text: string;
    type: MacroType;
    args: string[];
    description?: string;
  }>;

  /**
   * Allows custom suggestion kinds to be defined and correlate them with <Custom>StatementPosition.
   * @alpha
   */
  customSuggestionKinds?: SuggestionKindProvider;

  /**
   * Allows custom statement placement definition.
   * @alpha
   */
  customStatementPlacement?: StatementPlacementProvider;

  /**
   * Allows providing a custom function for resolving db tables.
   * It's up to the consumer to decide whether the columns are resolved via API calls or preloaded in the query editor(i.e. full db schema is preloades loaded).
   * @alpha
   */
  tables?: {
    resolve: () => Promise<TableDefinition[]>;
    // Allows providing a custom function for calculating the table name from the query. If not specified a default implemnentation is used.
    parseName?: (t: LinkedToken) => string;
  };
  /**
   * Allows providing a custom function for resolving table.
   * It's up to the consumer to decide whether the columns are resolved via API calls or preloaded in the query editor(i.e. full db schema is preloades loaded).
   * @alpha
   */
  columns?: {
    resolve: (table: string) => Promise<ColumnDefinition[]>;
  };

  /**
   * TODO: Not sure whether or not we need this. Would like to avoid this kind of flexibility.
   * @alpha
   */
  provideCompletionItems?: (
    model: monacoTypes.editor.ITextModel,
    position: monacoTypes.Position,
    context: monacoTypes.languages.CompletionContext,
    token: monacoTypes.CancellationToken,
    positionContext: PositionContext // Decorates original provideCompletionItems function with our custom statement position context
  ) => monacoTypes.languages.CompletionList;
}

export type LanguageCompletionProvider = (m: Monaco) => SQLCompletionItemProvider;

export enum OperatorType {
  Comparison,
  Logical,
}

export enum MacroType {
  Value,
  Filter,
  Group,
  Column,
  Table,
}

export enum TokenType {
  Parenthesis = 'delimiter.parenthesis.sql',
  Whitespace = 'white.sql',
  Keyword = 'keyword.sql',
  Delimiter = 'delimiter.sql',
  Operator = 'operator.sql',
  Identifier = 'identifier.sql',
  IdentifierQuote = 'identifier.quote.sql',
  Type = 'type.sql',
  Function = 'predefined.sql',
  Number = 'number.sql',
  String = 'string.sql',
  Variable = 'variable.sql',
}

export enum StatementPosition {
  Unknown = 'unknown',
  SelectKeyword = 'selectKeyword',
  WithKeyword = 'withKeyword',
  AfterSelectKeyword = 'afterSelectKeyword',
  AfterSelectArguments = 'afterSelectArguments',
  AfterSelectFuncFirstArgument = 'afterSelectFuncFirstArgument',
  SelectAlias = 'selectAlias',
  AfterFromKeyword = 'afterFromKeyword',
  AfterTable = 'afterTable',
  SchemaFuncFirstArgument = 'schemaFuncFirstArgument',
  SchemaFuncExtraArgument = 'schemaFuncExtraArgument',
  FromKeyword = 'fromKeyword',
  AfterFrom = 'afterFrom',
  WhereKeyword = 'whereKeyword',
  WhereComparisonOperator = 'whereComparisonOperator',
  WhereValue = 'whereValue',
  AfterWhereFunctionArgument = 'afterWhereFunctionArgument',
  AfterGroupByFunctionArgument = 'afterGroupByFunctionArgument',
  AfterWhereValue = 'afterWhereValue',
  AfterGroupByKeywords = 'afterGroupByKeywords',
  AfterGroupBy = 'afterGroupBy',
  AfterOrderByKeywords = 'afterOrderByKeywords',
  AfterOrderByFunction = 'afterOrderByFunction',
  AfterOrderByDirection = 'afterOrderByDirection',
  AfterIsOperator = 'afterIsOperator',
  AfterIsNotOperator = 'afterIsNotOperator',
}

export enum SuggestionKind {
  Tables = 'tables',
  Columns = 'columns',
  SelectKeyword = 'selectKeyword',
  WithKeyword = 'withKeyword',
  FunctionsWithArguments = 'functionsWithArguments',
  FromKeyword = 'fromKeyword',
  WhereKeyword = 'whereKeyword',
  GroupByKeywords = 'groupByKeywords',
  OrderByKeywords = 'orderByKeywords',
  FunctionsWithoutArguments = 'functionsWithoutArguments',
  LimitKeyword = 'limitKeyword',
  SortOrderDirectionKeyword = 'sortOrderDirectionKeyword',
  ComparisonOperators = 'comparisonOperators',
  LogicalOperators = 'logicalOperators',
  SelectMacro = 'selectMacro',
  TableMacro = 'tableMacro',
  FilterMacro = 'filterMacro',
  GroupMacro = 'groupMacro',
  BoolValues = 'boolValues',
  NullValue = 'nullValue',
  NotKeyword = 'notKeyword',
  TemplateVariables = 'templateVariables',
}

// TODO: export from grafana/ui
export enum CompletionItemPriority {
  High = 'a',
  MediumHigh = 'd',
  Medium = 'g',
  MediumLow = 'k',
  Low = 'q',
}

export enum CompletionItemKind {
  Method = 0,
  Function = 1,
  Constructor = 2,
  Field = 3,
  Variable = 4,
  Class = 5,
  Struct = 6,
  Interface = 7,
  Module = 8,
  Property = 9,
  Event = 10,
  Operator = 11,
  Unit = 12,
  Value = 13,
  Constant = 14,
  Enum = 15,
  EnumMember = 16,
  Keyword = 17,
  Text = 18,
  Color = 19,
  File = 20,
  Reference = 21,
  Customcolor = 22,
  Folder = 23,
  TypeParameter = 24,
  User = 25,
  Issue = 26,
  Snippet = 27,
}

export enum CompletionItemInsertTextRule {
  KeepWhitespace = 1,
  InsertAsSnippet = 4,
}
