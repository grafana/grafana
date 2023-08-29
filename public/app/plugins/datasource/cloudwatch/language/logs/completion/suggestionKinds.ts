import { StatementPosition, SuggestionKind } from '../../monarch/types';

export function getSuggestionKinds(statementPosition: StatementPosition): SuggestionKind[] {
  switch (statementPosition) {
    case StatementPosition.NewCommand:
      return [SuggestionKind.Command];
    case StatementPosition.AfterSortKeyword:
    case StatementPosition.SortArg:
      return [SuggestionKind.SortOrderDirectionKeyword, SuggestionKind.Function];
    case StatementPosition.AfterDisplayKeyword:
    case StatementPosition.AfterFieldsKeyword:
    case StatementPosition.AfterFilterKeyword:
    case StatementPosition.AfterStatsKeyword:
    case StatementPosition.AfterLimitKeyword:
    case StatementPosition.AfterParseKeyword:
    case StatementPosition.AfterDedupKeyword:
    case StatementPosition.CommandArg:
    case StatementPosition.FunctionArg:
    case StatementPosition.ArithmeticOperatorArg:
    case StatementPosition.BooleanOperatorArg:
    case StatementPosition.ComparisonOperatorArg:
      return [SuggestionKind.Function];
    case StatementPosition.FilterArg:
      return [SuggestionKind.InKeyword, SuggestionKind.Function];
  }

  return [];
}
