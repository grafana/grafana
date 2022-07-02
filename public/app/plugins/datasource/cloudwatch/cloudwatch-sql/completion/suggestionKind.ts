import { StatementPosition, SuggestionKind } from '../../monarch/types';

export function getSuggestionKinds(statementPosition: StatementPosition): SuggestionKind[] {
  switch (statementPosition) {
    case StatementPosition.SelectKeyword:
      return [SuggestionKind.SelectKeyword];
    case StatementPosition.AfterSelectKeyword:
      return [SuggestionKind.FunctionsWithArguments];
    case StatementPosition.AfterSelectFuncFirstArgument:
      return [SuggestionKind.Metrics];
    case StatementPosition.AfterFromKeyword:
      return [SuggestionKind.Namespaces, SuggestionKind.SchemaKeyword];
    case StatementPosition.SchemaFuncFirstArgument:
      return [SuggestionKind.Namespaces];
    case StatementPosition.SchemaFuncExtraArgument:
      return [SuggestionKind.LabelKeys];
    case StatementPosition.FromKeyword:
      return [SuggestionKind.FromKeyword];
    case StatementPosition.AfterFrom:
      return [
        SuggestionKind.WhereKeyword,
        SuggestionKind.GroupByKeywords,
        SuggestionKind.OrderByKeywords,
        SuggestionKind.LimitKeyword,
      ];
    case StatementPosition.WhereKey:
      return [SuggestionKind.LabelKeys];
    case StatementPosition.WhereComparisonOperator:
      return [SuggestionKind.ComparisonOperators];
    case StatementPosition.WhereValue:
      return [SuggestionKind.LabelValues];
    case StatementPosition.AfterWhereValue:
      return [
        SuggestionKind.LogicalOperators,
        SuggestionKind.GroupByKeywords,
        SuggestionKind.OrderByKeywords,
        SuggestionKind.LimitKeyword,
      ];
    case StatementPosition.AfterGroupByKeywords:
      return [SuggestionKind.LabelKeys];
    case StatementPosition.AfterGroupBy:
      return [SuggestionKind.OrderByKeywords, SuggestionKind.LimitKeyword];
    case StatementPosition.AfterOrderByKeywords:
      return [SuggestionKind.FunctionsWithoutArguments];
    case StatementPosition.AfterOrderByFunction:
      return [SuggestionKind.SortOrderDirectionKeyword, SuggestionKind.LimitKeyword];
    case StatementPosition.AfterOrderByDirection:
      return [SuggestionKind.LimitKeyword];
  }

  return [];
}
