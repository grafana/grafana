import { StatementPosition, SuggestionKind } from '../../monarch/types';

const rd = (r: SuggestionKind[], ...args: Array<string | StatementPosition | null | undefined>) => {
  console.log('getSuggestionKinds:', r, ...args);
  return r;
};

export function getSuggestionKinds(statementPosition: StatementPosition): SuggestionKind[] {
  switch (statementPosition) {
    case StatementPosition.NewCommand:
      return rd([SuggestionKind.Command]);
    case StatementPosition.AfterSortKeyword:
    case StatementPosition.SortArg:
      return rd([SuggestionKind.SortOrderDirectionKeyword, SuggestionKind.Function]);
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
      return rd([SuggestionKind.Function]);
  }

  return [];
}
