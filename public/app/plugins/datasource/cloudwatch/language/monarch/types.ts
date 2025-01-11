import { monacoTypes } from '@grafana/ui';

import { LanguageDefinition } from './register';

export type CompletionItem = monacoTypes.languages.CompletionItem;

export interface TokenTypes {
  Parenthesis: string;
  Whitespace: string;
  Keyword: string;
  Delimiter: string;
  Operator: string;
  Identifier: string;
  Type: string;
  Function: string;
  Number: string;
  String: string;
  Variable: string;
  Comment: string;
  Regexp: string;
}

export enum StatementPosition {
  Unknown,
  // sql
  SelectKeyword,
  AfterSelectKeyword,
  SelectExpression,
  AfterSelectExpression,
  AfterSelectFuncFirstArgument,
  PredefinedFunctionArgument,
  FromKeyword,
  AfterFrom,
  AfterFromKeyword,
  AfterFromArguments,
  SchemaFuncFirstArgument,
  SchemaFuncExtraArgument,
  WhereKey,
  WhereComparisonOperator,
  WhereValue,
  AfterWhereValue,
  HavingKey,
  HavingComparisonOperator,
  HavingValue,
  AfterHavingValue,
  CaseKey,
  CaseComparisonOperator,
  CaseValue,
  AfterCaseValue,
  WhenKey,
  WhenComparisonOperator,
  WhenValue,
  AfterWhenValue,
  ThenExpression,
  AfterThenExpression,
  AfterElseKeyword,
  OnKey,
  OnComparisonOperator,
  OnValue,
  AfterOnValue,
  AfterGroupByKeywords,
  AfterGroupBy,
  AfterOrderByKeywords,
  AfterOrderByFunction,
  AfterOrderByDirection,
  Subquery,
  // metric math
  PredefinedFunction,
  SearchFuncSecondArg,
  SearchFuncThirdArg,
  PredefinedFuncSecondArg,
  AfterFunction,
  WithinString,
  // logs
  NewCommand,
  Comment,

  DedupKeyword,
  AfterDedupKeyword,
  DisplayKeyword,
  AfterDisplayKeyword,
  FieldsKeyword,
  AfterFieldsKeyword,
  FilterKeyword,
  AfterFilterKeyword,
  FilterArg,
  LimitKeyword,
  AfterLimitKeyword,
  ParseKeyword,
  AfterParseKeyword,
  SortKeyword,
  AfterSortKeyword,
  SortArg,
  StatsKeyword,
  AfterStatsKeyword,

  AsKeyword,
  AfterAsKeyword,
  ByKeyword,
  AfterByKeyword,
  InKeyword,
  AfterInKeyword,
  LikeKeyword,
  AfterLikeKeyword,

  Function,
  FunctionArg,
  CommandArg,
  AfterCommand,

  ArithmeticOperator,
  ArithmeticOperatorArg,
  BooleanOperator,
  BooleanOperatorArg,
  ComparisonOperator,
  ComparisonOperatorArg,

  //PPL
  BeforeLogicalExpression,
  AfterArithmeticOperator,
  AfterINKeyword,
  SortField,
  AfterHeadCommand,
  AfterFieldsCommand,
  FieldList,
  AfterDedupFieldNames,
  AfterStatsCommand,
  StatsFunctionArgument,
  AfterStatsBy,
  AfterBooleanArgument,
  EvalClause,
  Expression,
  SortFieldExpression,
}

export enum SuggestionKind {
  SelectKeyword,
  AfterSelectKeyword,
  AfterSelectExpression,
  FunctionsWithArguments,
  Metrics,
  FromKeyword,
  AfterFromKeyword,
  AfterFromArguments,
  JoinKeywords,
  HavingKeywords,
  SchemaKeyword,
  Namespaces,
  LabelKeys,
  WhereKeyword,
  GroupByKeywords,
  OrderByKeywords,
  FunctionsWithoutArguments,
  LimitKeyword,
  SortOrderDirectionKeyword,
  ComparisonOperators,
  LabelValues,
  LogicalOperators,
  CaseKeyword,
  WhenKeyword,
  ThenKeyword,
  AfterThenExpression,

  // metricmath,
  KeywordArguments,
  Operators,
  Statistic,
  Period,

  // logs
  Command,
  Function,
  InKeyword,

  // PPL
  BooleanFunction,
  LogicalExpression,
  ValueExpression,
  FieldOperators,
  Field,
  BooleanLiteral,
  DedupParameter,
  StatsParameter,
  BooleanArgument,
  StatsFunctions,
  SpanClause,
  SortFunctions,
}

export enum CompletionItemPriority {
  High = 'a',
  MediumHigh = 'd',
  Medium = 'g',
  MediumLow = 'k',
  Low = 'q',
}

export interface Editor {
  tokenize: (value: string, languageId: string) => monacoTypes.Token[][];
}

export interface Range {
  containsPosition: (range: monacoTypes.IRange, position: monacoTypes.IPosition) => boolean;
  fromPositions: (start: monacoTypes.IPosition, end?: monacoTypes.IPosition) => monacoTypes.Range;
}

export interface Languages {
  CompletionItemInsertTextRule: {
    InsertAsSnippet: 4;
  };
  CompletionItemKind: {
    Function: 1;
  };
}
export interface Monaco {
  editor: Editor;
  Range: Range;
  languages: Languages;
}

export interface Completeable {
  getCompletionProvider(
    monaco: Monaco,
    languageDefinition: LanguageDefinition
  ): monacoTypes.languages.CompletionItemProvider;
}
