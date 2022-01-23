import { LinkedToken } from '../../monarch/LinkedToken';
import { StatementPosition } from '../../monarch/types';
import { MetricMathTokenTypes } from './types';

export function getStatementPosition(currentToken: LinkedToken | null): StatementPosition {
  const previousNonWhiteSpace = currentToken?.getPreviousNonWhiteSpaceToken();

  if (currentToken && previousNonWhiteSpace && previousNonWhiteSpace.is(MetricMathTokenTypes.Delimiter, ',')) {
    const currentFunction = currentToken.getPreviousOfType(MetricMathTokenTypes.Function);
    if (currentFunction && currentFunction.value === 'SEARCH') {
      const lastComma = previousNonWhiteSpace.getPreviousOfType(MetricMathTokenTypes.Delimiter, ',');
      if (lastComma) {
        const lastCommaIsAfterSearch =
          lastComma.range.startColumn > currentFunction.range.startColumn &&
          lastComma.range.startLineNumber >= currentFunction.range.startLineNumber;

        // TODO: figure out best way to suggest a period of time... is there a way to use a macro for this for example
        if (lastCommaIsAfterSearch) {
          return StatementPosition.ThirdArgAfterSearchFunc;
        }
      }
      return StatementPosition.SecondArgAfterSearchFunc;
    }
    return StatementPosition.SecondaryArgAfterPredefinedFunction;
  }

  if (previousNonWhiteSpace?.endsWith(')')) {
    return StatementPosition.AfterFunction;
  }

  if (!currentToken || !currentToken.isString()) {
    return StatementPosition.PredefinedFunction;
  }

  return StatementPosition.Unknown;
}
