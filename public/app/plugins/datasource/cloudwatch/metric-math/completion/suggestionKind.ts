import { StatementPosition, SuggestionKind } from '../../monarch/types';

export function getSuggestionKinds(statementPosition: StatementPosition): SuggestionKind[] {
  switch (statementPosition) {
    case StatementPosition.PredefinedFunction:
      return [SuggestionKind.FunctionsWithArguments];
    case StatementPosition.SecondaryArgAfterPredefinedFunction:
      return [SuggestionKind.FunctionsWithArguments, SuggestionKind.KeywordArguments];
    case StatementPosition.AfterFunction:
      return [SuggestionKind.Operators];
  }

  return [];
}
