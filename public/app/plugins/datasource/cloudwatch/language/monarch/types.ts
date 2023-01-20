import { monacoTypes } from '@grafana/ui';

import { LanguageDefinition } from './register';

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
  SearchFuncSecondArg,
  SearchFuncThirdArg,
  PredefinedFuncSecondArg,
  AfterFunction,
  WithinString,
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
  Operators,
  Statistic,
  Period,
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
