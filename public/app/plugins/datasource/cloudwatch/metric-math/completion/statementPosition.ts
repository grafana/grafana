import { LinkedToken } from '../../monarch/LinkedToken';
import { StatementPosition } from '../../monarch/types';
import { MetricMathTokenType } from './types';

export function getStatementPosition(currentToken: LinkedToken | null): StatementPosition {
  const previousNonWhiteSpace = currentToken?.getPreviousNonWhiteSpaceToken();

  if (previousNonWhiteSpace?.is(MetricMathTokenType.Delimiter, ',')) {
    return StatementPosition.SecondaryArgAfterPredefinedFunction;
  }

  if (previousNonWhiteSpace?.endsWith(')') && !previousNonWhiteSpace.is(MetricMathTokenType.Parenthesis, '()')) {
    return StatementPosition.AfterFunction;
  }

  if (!currentToken || !currentToken.isString()) {
    return StatementPosition.PredefinedFunction;
  }

  return StatementPosition.Unknown;
}
