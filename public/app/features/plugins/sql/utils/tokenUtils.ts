import { FROM, SCHEMA, SELECT } from '../standardSql/language';
import { TokenType } from '../types';

import { LinkedToken } from './LinkedToken';

export const getSelectToken = (currentToken: LinkedToken | null) =>
  currentToken?.getPreviousOfType(TokenType.Keyword, SELECT) ?? null;

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
  return selectToken?.getNextOfType(TokenType.Keyword, FROM);
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
  } else if (nextNonWhiteSpace?.isKeyword() && nextNonWhiteSpace.next?.is(TokenType.Parenthesis, '(')) {
    // schema is specified
    const assumedNamespaceToken = nextNonWhiteSpace.next?.next;
    if (assumedNamespaceToken?.isDoubleQuotedString() || assumedNamespaceToken?.isVariable()) {
      return assumedNamespaceToken;
    }
  }
  return null;
};

export const getTableToken = (currentToken: LinkedToken | null) => {
  const fromToken = getFromKeywordToken(currentToken);
  const nextNonWhiteSpace = fromToken?.getNextNonWhiteSpaceToken();
  if (nextNonWhiteSpace?.isVariable()) {
    // TODO: resolve column from variable?
    return null;
  } else if (nextNonWhiteSpace?.isKeyword() && nextNonWhiteSpace.next?.is(TokenType.Parenthesis, '(')) {
    return null;
  } else {
    return nextNonWhiteSpace;
  }
  return null;
};
