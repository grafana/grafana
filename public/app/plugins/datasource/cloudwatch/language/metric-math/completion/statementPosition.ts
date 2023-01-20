import { LinkedToken } from '../../monarch/LinkedToken';
import { StatementPosition } from '../../monarch/types';

import { MetricMathTokenTypes } from './types';

export function getStatementPosition(currentToken: LinkedToken | null): StatementPosition {
  const previousNonWhiteSpace = currentToken?.getPreviousNonWhiteSpaceToken();

  if (currentToken && currentToken.isString()) {
    return StatementPosition.WithinString;
  }

  if (currentToken && previousNonWhiteSpace) {
    const currentFunction = currentToken.getPreviousOfType(MetricMathTokenTypes.Function);
    const isAfterComma = previousNonWhiteSpace.is(MetricMathTokenTypes.Delimiter, ',');
    const isWithinSearch = currentFunction && currentFunction.value === 'SEARCH';
    const allTokensAfterStartOfSearch =
      currentToken.getPreviousUntil(MetricMathTokenTypes.Function, [], 'SEARCH') || [];

    if (isWithinSearch) {
      // if there's only one ' then we're still within the first arg
      if (allTokensAfterStartOfSearch.filter(({ value }) => value === "'").length === 1) {
        return StatementPosition.WithinString;
      }

      // if there was a , before the last , and it happened after the start of SEARCH
      const lastComma = previousNonWhiteSpace.getPreviousOfType(MetricMathTokenTypes.Delimiter, ',');
      if (lastComma) {
        const lastCommaIsAfterSearch =
          lastComma.range.startColumn > currentFunction.range.startColumn &&
          lastComma.range.startLineNumber >= currentFunction.range.startLineNumber;
        if (lastCommaIsAfterSearch) {
          return StatementPosition.SearchFuncThirdArg;
        }
      }

      // otherwise assume it's the second arg
      return StatementPosition.SearchFuncSecondArg;
    }

    if (!isWithinSearch && isAfterComma) {
      return StatementPosition.PredefinedFuncSecondArg;
    }
  }

  if (previousNonWhiteSpace?.endsWith(')')) {
    return StatementPosition.AfterFunction;
  }

  if (!currentToken || !currentToken.isString()) {
    return StatementPosition.PredefinedFunction;
  }

  return StatementPosition.Unknown;
}
