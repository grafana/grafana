import { monacoTypes } from '@grafana/ui';

export enum TokenType {
  Parenthesis = 'delimiter.parenthesis.sql',
  Whitespace = 'white.sql',
  Keyword = 'keyword.sql',
  Delimiter = 'delimiter.sql',
  Operator = 'operator.sql',
  Identifier = 'identifier.sql',
  Type = 'type.sql',
  Function = 'predefined.sql',
  Number = 'number.sql',
  String = 'string.sql',
  Variable = 'variable.sql',
}

export enum StatementPosition {
  Unknown,
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
