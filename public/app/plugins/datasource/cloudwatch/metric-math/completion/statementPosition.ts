import { LinkedToken } from '../../monarch/LinkedToken';
import { StatementPosition } from '../../monarch/types';
import { MetricMathTokenType } from './types';

export function getStatementPosition(currentToken: LinkedToken | null): StatementPosition {
  const previousNonWhiteSpace = currentToken?.getPreviousNonWhiteSpaceToken();

  // keywords can be passed as arguments after the first argument to a function
  if (previousNonWhiteSpace?.is(MetricMathTokenType.Delimiter, ',')) {
    return StatementPosition.SecondaryArgAfterPredefinedFunction;
  }

  /*
    TODO:
    We can make this autocomplete smarter, for example:
    - different functions take different arguments and different number of arguments
    - SEARCH is a special function that always takes a string Search expression with it's own formatting
    - We could handle autocompleting logic operators, etc
  */

  return StatementPosition.PredefinedFunction;
}
