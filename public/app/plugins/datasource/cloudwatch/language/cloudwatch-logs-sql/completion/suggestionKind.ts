import { StatementPosition, SuggestionKind } from '../../monarch/types';

export function getSuggestionKinds(statementPosition: StatementPosition): SuggestionKind[] {
  switch (statementPosition) {
    case StatementPosition.SelectKeyword:
      return [SuggestionKind.SelectKeyword];
    case StatementPosition.AfterSelectKeyword:
      return [
        SuggestionKind.AfterSelectKeyword,
        SuggestionKind.FunctionsWithArguments,
        SuggestionKind.Field,
        SuggestionKind.CaseKeyword,
      ];
    case StatementPosition.SelectExpression:
      return [SuggestionKind.FunctionsWithArguments, SuggestionKind.Field, SuggestionKind.CaseKeyword];
    case StatementPosition.AfterSelectExpression:
      return [
        SuggestionKind.FromKeyword,
        SuggestionKind.FunctionsWithArguments,
        SuggestionKind.Field,
        SuggestionKind.CaseKeyword,
      ];

    case StatementPosition.FromKeyword:
      return [SuggestionKind.FromKeyword, SuggestionKind.FunctionsWithArguments, SuggestionKind.Field];
    case StatementPosition.AfterFromKeyword:
      return [SuggestionKind.AfterFromKeyword];
    case StatementPosition.AfterFromArguments:
      return [
        SuggestionKind.WhereKeyword,
        SuggestionKind.GroupByKeywords,
        SuggestionKind.OrderByKeywords,
        SuggestionKind.LimitKeyword,
        SuggestionKind.JoinKeywords,
        SuggestionKind.HavingKeywords,
      ];

    case StatementPosition.WhereKey:
      return [SuggestionKind.FunctionsWithArguments, SuggestionKind.Field, SuggestionKind.CaseKeyword];
    case StatementPosition.WhereComparisonOperator:
      return [SuggestionKind.ComparisonOperators];
    case StatementPosition.WhereValue:
      return [SuggestionKind.FunctionsWithArguments, SuggestionKind.Field];
    case StatementPosition.AfterWhereValue:
      return [
        SuggestionKind.LogicalOperators,
        SuggestionKind.GroupByKeywords,
        SuggestionKind.OrderByKeywords,
        SuggestionKind.LimitKeyword,
      ];

    case StatementPosition.HavingKey:
      return [SuggestionKind.FunctionsWithArguments, SuggestionKind.Field];
    case StatementPosition.HavingComparisonOperator:
      return [SuggestionKind.ComparisonOperators];
    case StatementPosition.HavingValue:
      return [SuggestionKind.FunctionsWithArguments, SuggestionKind.Field];
    case StatementPosition.AfterHavingValue:
      return [SuggestionKind.LogicalOperators, SuggestionKind.OrderByKeywords, SuggestionKind.LimitKeyword];

    case StatementPosition.OnKey:
      return [SuggestionKind.FunctionsWithArguments, SuggestionKind.Field];
    case StatementPosition.OnComparisonOperator:
      return [SuggestionKind.ComparisonOperators];
    case StatementPosition.OnValue:
      return [SuggestionKind.FunctionsWithArguments, SuggestionKind.Field];
    case StatementPosition.AfterOnValue:
      return [
        SuggestionKind.LogicalOperators,
        SuggestionKind.GroupByKeywords,
        SuggestionKind.OrderByKeywords,
        SuggestionKind.LimitKeyword,
      ];

    case StatementPosition.CaseKey:
      return [SuggestionKind.WhenKeyword, SuggestionKind.Field, SuggestionKind.FunctionsWithArguments];
    case StatementPosition.CaseComparisonOperator:
      return [SuggestionKind.ComparisonOperators, SuggestionKind.WhenKeyword];
    case StatementPosition.CaseValue:
      return [SuggestionKind.FunctionsWithArguments, SuggestionKind.Field];
    case StatementPosition.AfterCaseValue:
      return [SuggestionKind.WhenKeyword];

    case StatementPosition.WhenKey:
      return [SuggestionKind.Field, SuggestionKind.FunctionsWithArguments];
    case StatementPosition.WhenComparisonOperator:
      return [SuggestionKind.ComparisonOperators, SuggestionKind.ThenKeyword];
    case StatementPosition.WhenValue:
      return [SuggestionKind.FunctionsWithArguments, SuggestionKind.Field];
    case StatementPosition.AfterWhenValue:
      return [SuggestionKind.ThenKeyword];

    case StatementPosition.ThenExpression:
      return [SuggestionKind.FunctionsWithArguments, SuggestionKind.Field];
    case StatementPosition.AfterThenExpression:
      return [SuggestionKind.WhenKeyword, SuggestionKind.AfterThenExpression];

    case StatementPosition.AfterElseKeyword:
      return [SuggestionKind.FunctionsWithArguments, SuggestionKind.Field];

    case StatementPosition.AfterGroupByKeywords:
      return [SuggestionKind.Field, SuggestionKind.FunctionsWithArguments];
    case StatementPosition.AfterGroupBy:
      return [SuggestionKind.OrderByKeywords, SuggestionKind.LimitKeyword, SuggestionKind.HavingKeywords];

    case StatementPosition.AfterOrderByKeywords:
      return [SuggestionKind.SortOrderDirectionKeyword, SuggestionKind.LimitKeyword, SuggestionKind.Field];
    case StatementPosition.AfterOrderByDirection:
      return [SuggestionKind.LimitKeyword];

    case StatementPosition.PredefinedFunctionArgument:
      return [SuggestionKind.Field];

    case StatementPosition.Subquery:
      return [SuggestionKind.SelectKeyword, SuggestionKind.FunctionsWithArguments, SuggestionKind.Field];
  }

  return [];
}
