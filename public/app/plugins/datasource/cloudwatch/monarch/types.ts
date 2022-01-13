import { monacoTypes } from '@grafana/ui';

export interface TokenType {
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
}

export enum StatementPosition {
  Unknown,
  // sql
  SelectKeyword,
  AfterSelectKeyword,
  AfterSelectFuncFirstArgument,
  AfterFromKeyword,
  SchemaFuncFirstArgument,
  SchemaFuncExtraArgument,
  FromKeyword,
  AfterFrom,
  WhereKey,
  WhereComparisonOperator,
  WhereValue,
  AfterWhereValue,
  AfterGroupByKeywords,
  AfterGroupBy,
  AfterOrderByKeywords,
  AfterOrderByFunction,
  AfterOrderByDirection,
  // metric math
  PredefinedFunction,
  SecondaryArgAfterPredefinedFunction,
}

export enum SuggestionKind {
  SelectKeyword,
  FunctionsWithArguments,
  Metrics,
  FromKeyword,
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

  // metricmath,
  KeywordArguments,
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
}

export interface Monaco {
  editor: Editor;
  Range: Range;
}
