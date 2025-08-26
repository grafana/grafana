import { LinkedToken } from '../../monarch/LinkedToken';
import { StatementPosition } from '../../monarch/types';
import { AND, ASC, BY, DESC, EQUALS, FROM, GROUP, NOT_EQUALS, ORDER, SCHEMA, SELECT, WHERE } from '../language';

import { SQLTokenTypes } from './types';

// about getStatementPosition: public/app/plugins/datasource/cloudwatch/language/cloudwatch-ppl/completion/statementPosition.ts

export function getStatementPosition(currentToken: LinkedToken | null): StatementPosition {
  const previousNonWhiteSpace = currentToken?.getPreviousNonWhiteSpaceToken();
  const previousKeyword = currentToken?.getPreviousKeyword();

  const previousIsSlash = currentToken?.getPreviousNonWhiteSpaceToken()?.is(SQLTokenTypes.Operator, '/');
  if (
    currentToken === null ||
    (currentToken.isWhiteSpace() && currentToken.previous === null) ||
    (currentToken.is(SQLTokenTypes.Keyword, SELECT) && currentToken.previous === null) ||
    previousIsSlash ||
    (currentToken.isIdentifier() && (previousIsSlash || currentToken?.previous === null))
  ) {
    return StatementPosition.SelectKeyword;
  }

  if (previousNonWhiteSpace?.value === SELECT) {
    return StatementPosition.AfterSelectKeyword;
  }

  if (
    (previousNonWhiteSpace?.is(SQLTokenTypes.Parenthesis, '(') || currentToken?.is(SQLTokenTypes.Parenthesis, '()')) &&
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
    (previousNonWhiteSpace?.is(SQLTokenTypes.Parenthesis, '(') || currentToken?.is(SQLTokenTypes.Parenthesis, '()')) &&
    previousKeyword?.value === SCHEMA
  ) {
    return StatementPosition.SchemaFuncFirstArgument;
  }

  if (previousKeyword?.value === SCHEMA && previousNonWhiteSpace?.is(SQLTokenTypes.Delimiter, ',')) {
    return StatementPosition.SchemaFuncExtraArgument;
  }

  if (
    (previousKeyword?.value === FROM && previousNonWhiteSpace?.isDoubleQuotedString()) ||
    (previousKeyword?.value === FROM && previousNonWhiteSpace?.isVariable()) ||
    (previousKeyword?.value === SCHEMA && previousNonWhiteSpace?.is(SQLTokenTypes.Parenthesis, ')'))
  ) {
    return StatementPosition.AfterFrom;
  }

  if (
    previousKeyword?.value === WHERE &&
    (previousNonWhiteSpace?.isKeyword() ||
      previousNonWhiteSpace?.is(SQLTokenTypes.Parenthesis, '(') ||
      previousNonWhiteSpace?.is(SQLTokenTypes.Operator, AND))
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
    (previousNonWhiteSpace?.is(SQLTokenTypes.Operator, EQUALS) ||
      previousNonWhiteSpace?.is(SQLTokenTypes.Operator, NOT_EQUALS))
  ) {
    return StatementPosition.WhereValue;
  }

  if (
    previousKeyword?.value === WHERE &&
    (previousNonWhiteSpace?.isString() || previousNonWhiteSpace?.is(SQLTokenTypes.Parenthesis, ')'))
  ) {
    return StatementPosition.AfterWhereValue;
  }

  if (
    previousKeyword?.is(SQLTokenTypes.Keyword, BY) &&
    previousKeyword?.getPreviousKeyword()?.is(SQLTokenTypes.Keyword, GROUP) &&
    (previousNonWhiteSpace?.is(SQLTokenTypes.Keyword, BY) || previousNonWhiteSpace?.is(SQLTokenTypes.Delimiter, ','))
  ) {
    return StatementPosition.AfterGroupByKeywords;
  }

  if (
    previousKeyword?.is(SQLTokenTypes.Keyword, BY) &&
    previousKeyword?.getPreviousKeyword()?.is(SQLTokenTypes.Keyword, GROUP) &&
    (previousNonWhiteSpace?.isIdentifier() || previousNonWhiteSpace?.isDoubleQuotedString())
  ) {
    return StatementPosition.AfterGroupBy;
  }

  if (
    previousNonWhiteSpace?.is(SQLTokenTypes.Keyword, BY) &&
    previousNonWhiteSpace?.getPreviousKeyword()?.is(SQLTokenTypes.Keyword, ORDER)
  ) {
    return StatementPosition.AfterOrderByKeywords;
  }

  if (
    previousKeyword?.is(SQLTokenTypes.Keyword, BY) &&
    previousKeyword?.getPreviousKeyword()?.is(SQLTokenTypes.Keyword, ORDER) &&
    previousNonWhiteSpace?.is(SQLTokenTypes.Parenthesis) &&
    previousNonWhiteSpace?.getPreviousNonWhiteSpaceToken()?.is(SQLTokenTypes.Function)
  ) {
    return StatementPosition.AfterOrderByFunction;
  }

  if (previousKeyword?.is(SQLTokenTypes.Keyword, DESC) || previousKeyword?.is(SQLTokenTypes.Keyword, ASC)) {
    return StatementPosition.AfterOrderByDirection;
  }

  return StatementPosition.Unknown;
}
