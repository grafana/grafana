import { LinkedToken } from '../../monarch/LinkedToken';
import { FROM, SCHEMA, SELECT } from '../language';

import { SQLTokenTypes } from './types';

export const getSelectToken = (currentToken: LinkedToken | null) =>
  currentToken?.getPreviousOfType(SQLTokenTypes.Keyword, SELECT) ?? null;

export const getSelectStatisticToken = (currentToken: LinkedToken | null) => {
  const assumedStatisticToken = getSelectToken(currentToken)?.getNextNonWhiteSpaceToken();
  return assumedStatisticToken?.isVariable() || assumedStatisticToken?.isFunction() ? assumedStatisticToken : null;
};

export const getMetricNameToken = (currentToken: LinkedToken | null) => {
  // statistic function is followed by `(` and then an argument
  const assumedMetricNameToken = getSelectStatisticToken(currentToken)?.next?.next;
  return assumedMetricNameToken?.isVariable() || assumedMetricNameToken?.isIdentifier() ? assumedMetricNameToken : null;
};

export const getFromKeywordToken = (currentToken: LinkedToken | null) => {
  const selectToken = getSelectToken(currentToken);
  return selectToken?.getNextOfType(SQLTokenTypes.Keyword, FROM);
};

export const getNamespaceToken = (currentToken: LinkedToken | null) => {
  const fromToken = getFromKeywordToken(currentToken);
  const nextNonWhiteSpace = fromToken?.getNextNonWhiteSpaceToken();
  if (
    nextNonWhiteSpace?.isDoubleQuotedString() ||
    (nextNonWhiteSpace?.isVariable() && nextNonWhiteSpace?.value.toUpperCase() !== SCHEMA)
  ) {
    // schema is not used
    return nextNonWhiteSpace;
  } else if (nextNonWhiteSpace?.isKeyword() && nextNonWhiteSpace.next?.is(SQLTokenTypes.Parenthesis, '(')) {
    // schema is specified
    const assumedNamespaceToken = nextNonWhiteSpace.next?.next;
    if (assumedNamespaceToken?.isDoubleQuotedString() || assumedNamespaceToken?.isVariable()) {
      return assumedNamespaceToken;
    }
  }
  return null;
};
