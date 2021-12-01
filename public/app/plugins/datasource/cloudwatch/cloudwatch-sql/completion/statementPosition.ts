import { AND, ASC, BY, DESC, EQUALS, FROM, GROUP, NOT_EQUALS, ORDER, SCHEMA, SELECT, WHERE } from '../language';
import { LinkedToken } from './LinkedToken';
import { StatementPosition, TokenType } from './types';

export function getStatementPosition(currentToken: LinkedToken | null): StatementPosition {
  const previousNonWhiteSpace = currentToken?.getPreviousNonWhiteSpaceToken();
  const previousKeyword = currentToken?.getPreviousKeyword();

  const previousIsSlash = currentToken?.getPreviousNonWhiteSpaceToken()?.is(TokenType.Operator, '/');
  if (
    currentToken === null ||
    (currentToken.isWhiteSpace() && currentToken.previous === null) ||
    (currentToken.is(TokenType.Keyword, SELECT) && currentToken.previous === null) ||
    previousIsSlash ||
    (currentToken.isIdentifier() && (previousIsSlash || currentToken?.previous === null))
  ) {
    return StatementPosition.SelectKeyword;
  }

  if (previousNonWhiteSpace?.value === SELECT) {
    return StatementPosition.AfterSelectKeyword;
  }

  if (
    (previousNonWhiteSpace?.is(TokenType.Parenthesis, '(') || currentToken?.is(TokenType.Parenthesis, '()')) &&
    previousKeyword?.value === SELECT
  ) {
    return StatementPosition.AfterSelectFuncFirstArgument;
  }

  if (previousKeyword?.value === SELECT && previousNonWhiteSpace?.isParenthesis()) {
    return StatementPosition.FromKeyword;
  }

  if (previousNonWhiteSpace?.value === FROM) {
    return StatementPosition.AfterFromKeyword;
  }

  if (
    (previousNonWhiteSpace?.is(TokenType.Parenthesis, '(') || currentToken?.is(TokenType.Parenthesis, '()')) &&
    previousKeyword?.value === SCHEMA
  ) {
    return StatementPosition.SchemaFuncFirstArgument;
  }

  if (previousKeyword?.value === SCHEMA && previousNonWhiteSpace?.is(TokenType.Delimiter, ',')) {
    return StatementPosition.SchemaFuncExtraArgument;
  }

  if (
    (previousKeyword?.value === FROM && previousNonWhiteSpace?.isDoubleQuotedString()) ||
    (previousKeyword?.value === FROM && previousNonWhiteSpace?.isVariable()) ||
    (previousKeyword?.value === SCHEMA && previousNonWhiteSpace?.is(TokenType.Parenthesis, ')'))
  ) {
    return StatementPosition.AfterFrom;
  }

  if (
    previousKeyword?.value === WHERE &&
    (previousNonWhiteSpace?.isKeyword() ||
      previousNonWhiteSpace?.is(TokenType.Parenthesis, '(') ||
      previousNonWhiteSpace?.is(TokenType.Operator, AND))
  ) {
    return StatementPosition.WhereKey;
  }

  if (
    previousKeyword?.value === WHERE &&
    (previousNonWhiteSpace?.isIdentifier() || previousNonWhiteSpace?.isDoubleQuotedString())
  ) {
    return StatementPosition.WhereComparisonOperator;
  }

  if (
    previousKeyword?.value === WHERE &&
    (previousNonWhiteSpace?.is(TokenType.Operator, EQUALS) || previousNonWhiteSpace?.is(TokenType.Operator, NOT_EQUALS))
  ) {
    return StatementPosition.WhereValue;
  }

  if (
    previousKeyword?.value === WHERE &&
    (previousNonWhiteSpace?.isString() || previousNonWhiteSpace?.is(TokenType.Parenthesis, ')'))
  ) {
    return StatementPosition.AfterWhereValue;
  }

  if (
    previousKeyword?.is(TokenType.Keyword, BY) &&
    previousKeyword?.getPreviousKeyword()?.is(TokenType.Keyword, GROUP) &&
    (previousNonWhiteSpace?.is(TokenType.Keyword, BY) || previousNonWhiteSpace?.is(TokenType.Delimiter, ','))
  ) {
    return StatementPosition.AfterGroupByKeywords;
  }

  if (
    previousKeyword?.is(TokenType.Keyword, BY) &&
    previousKeyword?.getPreviousKeyword()?.is(TokenType.Keyword, GROUP) &&
    (previousNonWhiteSpace?.isIdentifier() || previousNonWhiteSpace?.isDoubleQuotedString())
  ) {
    return StatementPosition.AfterGroupBy;
  }

  if (
    previousNonWhiteSpace?.is(TokenType.Keyword, BY) &&
    previousNonWhiteSpace?.getPreviousKeyword()?.is(TokenType.Keyword, ORDER)
  ) {
    return StatementPosition.AfterOrderByKeywords;
  }

  if (
    previousKeyword?.is(TokenType.Keyword, BY) &&
    previousKeyword?.getPreviousKeyword()?.is(TokenType.Keyword, ORDER) &&
    previousNonWhiteSpace?.is(TokenType.Parenthesis) &&
    previousNonWhiteSpace?.getPreviousNonWhiteSpaceToken()?.is(TokenType.Function)
  ) {
    return StatementPosition.AfterOrderByFunction;
  }

  if (previousKeyword?.is(TokenType.Keyword, DESC) || previousKeyword?.is(TokenType.Keyword, ASC)) {
    return StatementPosition.AfterOrderByDirection;
  }

  return StatementPosition.Unknown;
}
