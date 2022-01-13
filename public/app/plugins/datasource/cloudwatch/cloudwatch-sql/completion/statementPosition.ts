import { AND, ASC, BY, DESC, EQUALS, FROM, GROUP, NOT_EQUALS, ORDER, SCHEMA, SELECT, WHERE } from '../language';
import { LinkedToken } from '../../monarch/LinkedToken';
import { StatementPosition } from '../../monarch/types';
import { SQLTokenType } from './types';

export function getStatementPosition(currentToken: LinkedToken | null): StatementPosition {
  const previousNonWhiteSpace = currentToken?.getPreviousNonWhiteSpaceToken();
  const previousKeyword = currentToken?.getPreviousKeyword();

  const previousIsSlash = currentToken?.getPreviousNonWhiteSpaceToken()?.is(SQLTokenType.Operator, '/');
  if (
    currentToken === null ||
    (currentToken.isWhiteSpace() && currentToken.previous === null) ||
    (currentToken.is(SQLTokenType.Keyword, SELECT) && currentToken.previous === null) ||
    previousIsSlash ||
    (currentToken.isIdentifier() && (previousIsSlash || currentToken?.previous === null))
  ) {
    return StatementPosition.SelectKeyword;
  }

  if (previousNonWhiteSpace?.value === SELECT) {
    return StatementPosition.AfterSelectKeyword;
  }

  if (
    (previousNonWhiteSpace?.is(SQLTokenType.Parenthesis, '(') || currentToken?.is(SQLTokenType.Parenthesis, '()')) &&
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
    (previousNonWhiteSpace?.is(SQLTokenType.Parenthesis, '(') || currentToken?.is(SQLTokenType.Parenthesis, '()')) &&
    previousKeyword?.value === SCHEMA
  ) {
    return StatementPosition.SchemaFuncFirstArgument;
  }

  if (previousKeyword?.value === SCHEMA && previousNonWhiteSpace?.is(SQLTokenType.Delimiter, ',')) {
    return StatementPosition.SchemaFuncExtraArgument;
  }

  if (
    (previousKeyword?.value === FROM && previousNonWhiteSpace?.isDoubleQuotedString()) ||
    (previousKeyword?.value === FROM && previousNonWhiteSpace?.isVariable()) ||
    (previousKeyword?.value === SCHEMA && previousNonWhiteSpace?.is(SQLTokenType.Parenthesis, ')'))
  ) {
    return StatementPosition.AfterFrom;
  }

  if (
    previousKeyword?.value === WHERE &&
    (previousNonWhiteSpace?.isKeyword() ||
      previousNonWhiteSpace?.is(SQLTokenType.Parenthesis, '(') ||
      previousNonWhiteSpace?.is(SQLTokenType.Operator, AND))
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
    (previousNonWhiteSpace?.is(SQLTokenType.Operator, EQUALS) ||
      previousNonWhiteSpace?.is(SQLTokenType.Operator, NOT_EQUALS))
  ) {
    return StatementPosition.WhereValue;
  }

  if (
    previousKeyword?.value === WHERE &&
    (previousNonWhiteSpace?.isString() || previousNonWhiteSpace?.is(SQLTokenType.Parenthesis, ')'))
  ) {
    return StatementPosition.AfterWhereValue;
  }

  if (
    previousKeyword?.is(SQLTokenType.Keyword, BY) &&
    previousKeyword?.getPreviousKeyword()?.is(SQLTokenType.Keyword, GROUP) &&
    (previousNonWhiteSpace?.is(SQLTokenType.Keyword, BY) || previousNonWhiteSpace?.is(SQLTokenType.Delimiter, ','))
  ) {
    return StatementPosition.AfterGroupByKeywords;
  }

  if (
    previousKeyword?.is(SQLTokenType.Keyword, BY) &&
    previousKeyword?.getPreviousKeyword()?.is(SQLTokenType.Keyword, GROUP) &&
    (previousNonWhiteSpace?.isIdentifier() || previousNonWhiteSpace?.isDoubleQuotedString())
  ) {
    return StatementPosition.AfterGroupBy;
  }

  if (
    previousNonWhiteSpace?.is(SQLTokenType.Keyword, BY) &&
    previousNonWhiteSpace?.getPreviousKeyword()?.is(SQLTokenType.Keyword, ORDER)
  ) {
    return StatementPosition.AfterOrderByKeywords;
  }

  if (
    previousKeyword?.is(SQLTokenType.Keyword, BY) &&
    previousKeyword?.getPreviousKeyword()?.is(SQLTokenType.Keyword, ORDER) &&
    previousNonWhiteSpace?.is(SQLTokenType.Parenthesis) &&
    previousNonWhiteSpace?.getPreviousNonWhiteSpaceToken()?.is(SQLTokenType.Function)
  ) {
    return StatementPosition.AfterOrderByFunction;
  }

  if (previousKeyword?.is(SQLTokenType.Keyword, DESC) || previousKeyword?.is(SQLTokenType.Keyword, ASC)) {
    return StatementPosition.AfterOrderByDirection;
  }

  return StatementPosition.Unknown;
}
