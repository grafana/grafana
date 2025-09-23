import { StatementPosition, SuggestionKind } from '../../monarch/types';

export function getSuggestionKinds(statementPosition: StatementPosition): SuggestionKind[] {
  switch (statementPosition) {
    case StatementPosition.PredefinedFunction:
      return [SuggestionKind.FunctionsWithArguments];
    case StatementPosition.PredefinedFuncSecondArg:
      return [SuggestionKind.FunctionsWithArguments, SuggestionKind.KeywordArguments];
    case StatementPosition.AfterFunction:
      return [SuggestionKind.Operators];
    case StatementPosition.SearchFuncSecondArg:
      return [SuggestionKind.Statistic];
    case StatementPosition.SearchFuncThirdArg:
      return [SuggestionKind.Period];
  }

  return [];
}
