import { LinkedToken } from '../../monarch/LinkedToken';
import { StatementPosition } from '../../monarch/types';
import {
  ALL,
  DISTINCT,
  AS,
  ASC,
  BY,
  DESC,
  FROM,
  GROUP,
  ORDER,
  SELECT,
  WHERE,
  HAVING,
  ON,
  LOGICAL_OPERATORS,
  PREDICATE_OPERATORS,
  NULL,
  TRUE,
  FALSE,
  IN,
  CASE,
  WHEN,
  THEN,
  ELSE,
  END,
} from '../language';

import { SQLTokenTypes } from './types';

export function getStatementPosition(currentToken: LinkedToken | null): StatementPosition {
  const previousNonWhiteSpace = currentToken?.getPreviousNonWhiteSpaceToken();
  const previousKeyword = currentToken?.getPreviousKeyword();

  const normalizedPreviousNonWhiteSpaceValue = previousNonWhiteSpace?.value?.toUpperCase() || '';
  const normalizedPreviousKeywordValue = previousKeyword?.value?.toUpperCase() || '';

  let previousNonAliasKeywordValue = previousKeyword;
  let normalizedPreviousNonAliasKeywordValue = normalizedPreviousKeywordValue;
  while (normalizedPreviousNonAliasKeywordValue === AS) {
    previousNonAliasKeywordValue = previousNonAliasKeywordValue?.getPreviousKeyword();
    normalizedPreviousNonAliasKeywordValue = previousNonAliasKeywordValue?.value.toUpperCase() || '';
  }

  const isPreviousSelectKeywordGroup =
    normalizedPreviousNonAliasKeywordValue === SELECT ||
    ([ALL, DISTINCT].includes(normalizedPreviousNonAliasKeywordValue) &&
      previousNonAliasKeywordValue?.getPreviousKeyword()?.value.toUpperCase() === SELECT);

  if (currentToken?.is(SQLTokenTypes.Comment) || currentToken?.is('comment.quote.cloudwatch-logs-sql')) {
    return StatementPosition.Comment;
  }

  if (
    currentToken === null ||
    (currentToken.previous === null && currentToken.isIdentifier()) ||
    (currentToken.previous === null && currentToken.isWhiteSpace()) ||
    (currentToken.previous === null && currentToken.isKeyword() && currentToken.value.toUpperCase() === SELECT)
  ) {
    return StatementPosition.SelectKeyword;
  }

  if (
    (currentToken.isWhiteSpace() || currentToken.is(SQLTokenTypes.Parenthesis, ')')) &&
    normalizedPreviousNonWhiteSpaceValue === SELECT
  ) {
    return StatementPosition.AfterSelectKeyword;
  }

  if (
    isPreviousSelectKeywordGroup &&
    (currentToken.is(SQLTokenTypes.Delimiter, ',') ||
      (currentToken.isWhiteSpace() && previousNonWhiteSpace?.is(SQLTokenTypes.Delimiter, ',')) ||
      (currentToken.isWhiteSpace() && previousNonWhiteSpace?.isKeyword()) ||
      (currentToken.is(SQLTokenTypes.Parenthesis, ')') &&
        (previousNonWhiteSpace?.isKeyword() || previousNonWhiteSpace?.is(SQLTokenTypes.Delimiter, ','))))
  ) {
    return StatementPosition.SelectExpression;
  }

  if (
    isPreviousSelectKeywordGroup &&
    (currentToken.isWhiteSpace() || currentToken.is(SQLTokenTypes.Parenthesis, ')')) &&
    (previousNonWhiteSpace?.isIdentifier() ||
      previousNonWhiteSpace?.is(SQLTokenTypes.Parenthesis, ')') ||
      previousNonWhiteSpace?.is(SQLTokenTypes.Parenthesis, '()') ||
      previousNonWhiteSpace?.is(SQLTokenTypes.Operator, '*'))
  ) {
    return StatementPosition.AfterSelectExpression;
  }

  if (
    currentToken.is(SQLTokenTypes.Parenthesis, '()') &&
    normalizedPreviousNonAliasKeywordValue === WHERE &&
    normalizedPreviousNonWhiteSpaceValue === IN
  ) {
    return StatementPosition.Subquery;
  }

  if (
    ((currentToken.is(SQLTokenTypes.Parenthesis, '()') || currentToken.is(SQLTokenTypes.Parenthesis, '())')) &&
      previousNonWhiteSpace?.isFunction()) ||
    (currentToken.is(SQLTokenTypes.Delimiter, ',') &&
      currentToken.getPreviousOfType(SQLTokenTypes.Parenthesis, '(')?.getPreviousNonWhiteSpaceToken()?.isFunction()) ||
    (currentToken.isWhiteSpace() &&
      previousNonWhiteSpace?.is(SQLTokenTypes.Delimiter, ',') &&
      currentToken.getPreviousOfType(SQLTokenTypes.Parenthesis, '(')?.getPreviousNonWhiteSpaceToken()?.isFunction()) ||
    (currentToken.is(SQLTokenTypes.Parenthesis, ')') &&
      previousNonWhiteSpace?.is(SQLTokenTypes.Delimiter, ',') &&
      currentToken.getPreviousOfType(SQLTokenTypes.Parenthesis, '(')?.getPreviousNonWhiteSpaceToken()?.isFunction())
  ) {
    return StatementPosition.PredefinedFunctionArgument;
  }

  if (
    (currentToken.isWhiteSpace() || currentToken.is(SQLTokenTypes.Parenthesis, ')')) &&
    normalizedPreviousNonWhiteSpaceValue === FROM
  ) {
    return StatementPosition.AfterFromKeyword;
  }

  if (
    normalizedPreviousNonAliasKeywordValue === FROM &&
    (previousNonWhiteSpace?.isIdentifier() ||
      previousNonWhiteSpace?.isDoubleQuotedString() ||
      previousNonWhiteSpace?.isVariable() ||
      previousNonWhiteSpace?.is(SQLTokenTypes.Parenthesis, ')'))
  ) {
    return StatementPosition.AfterFromArguments;
  }

  if (
    (LOGICAL_OPERATORS.includes(normalizedPreviousNonWhiteSpaceValue) &&
      [WHERE, HAVING, ON, CASE, WHEN].includes(normalizedPreviousKeywordValue)) ||
    ((currentToken.isWhiteSpace() || currentToken.is(SQLTokenTypes.Parenthesis, ')')) &&
      [WHERE, HAVING, ON, CASE, WHEN].includes(normalizedPreviousNonWhiteSpaceValue))
  ) {
    switch (normalizedPreviousKeywordValue) {
      case WHERE:
        return StatementPosition.WhereKey;
      case HAVING:
        return StatementPosition.HavingKey;
      case ON:
        return StatementPosition.OnKey;
      case CASE:
        return StatementPosition.CaseKey;
      case WHEN:
        return StatementPosition.WhenKey;
    }
  }

  if (
    (LOGICAL_OPERATORS.includes(normalizedPreviousNonWhiteSpaceValue) &&
      [NULL, TRUE, FALSE].includes(normalizedPreviousKeywordValue)) ||
    ((currentToken.isWhiteSpace() || currentToken.is(SQLTokenTypes.Parenthesis, ')')) &&
      [NULL, TRUE, FALSE].includes(normalizedPreviousNonWhiteSpaceValue))
  ) {
    let nearestPreviousKeyword = previousKeyword;
    let normalizedNearestPreviousKeywordValue = normalizedPreviousKeywordValue;
    while (![WHERE, HAVING, ON, CASE, WHEN].includes(normalizedNearestPreviousKeywordValue)) {
      nearestPreviousKeyword = nearestPreviousKeyword?.getPreviousKeyword();
      normalizedNearestPreviousKeywordValue = nearestPreviousKeyword?.value.toUpperCase() || '';
    }

    switch (normalizedNearestPreviousKeywordValue) {
      case WHERE:
        return StatementPosition.WhereKey;
      case HAVING:
        return StatementPosition.HavingKey;
      case ON:
        return StatementPosition.OnKey;
      case CASE:
        return StatementPosition.CaseKey;
      case WHEN:
        return StatementPosition.WhenKey;
    }
  }

  if (
    [WHERE, HAVING, ON, CASE, WHEN].includes(normalizedPreviousKeywordValue) &&
    PREDICATE_OPERATORS.includes(normalizedPreviousNonWhiteSpaceValue)
  ) {
    switch (normalizedPreviousKeywordValue) {
      case WHERE:
        return StatementPosition.WhereValue;
      case HAVING:
        return StatementPosition.HavingValue;
      case ON:
        return StatementPosition.OnValue;
      case CASE:
        return StatementPosition.CaseValue;
      case WHEN:
        return StatementPosition.WhenValue;
    }
  }

  if (
    [NULL, TRUE, FALSE].includes(normalizedPreviousKeywordValue) &&
    PREDICATE_OPERATORS.includes(normalizedPreviousNonWhiteSpaceValue)
  ) {
    let nearestPreviousKeyword = previousKeyword;
    let normalizedNearestPreviousKeywordValue = normalizedPreviousKeywordValue;
    while (![WHERE, HAVING, ON, CASE, WHEN].includes(normalizedNearestPreviousKeywordValue)) {
      nearestPreviousKeyword = nearestPreviousKeyword?.getPreviousKeyword();
      normalizedNearestPreviousKeywordValue = nearestPreviousKeyword?.value.toUpperCase() || '';
    }

    switch (normalizedNearestPreviousKeywordValue) {
      case WHERE:
        return StatementPosition.WhereValue;
      case HAVING:
        return StatementPosition.HavingValue;
      case ON:
        return StatementPosition.OnValue;
      case CASE:
        return StatementPosition.CaseValue;
      case WHEN:
        return StatementPosition.WhenValue;
    }
  }

  if (
    [WHERE, HAVING, ON, CASE, WHEN].includes(normalizedPreviousKeywordValue) &&
    (previousNonWhiteSpace?.isIdentifier() ||
      previousNonWhiteSpace?.isDoubleQuotedString() ||
      previousNonWhiteSpace?.isFunction() ||
      previousNonWhiteSpace?.isNumber() ||
      previousNonWhiteSpace?.isString() ||
      previousNonWhiteSpace?.is(SQLTokenTypes.Parenthesis, ')') ||
      previousNonWhiteSpace?.is(SQLTokenTypes.Parenthesis, '()'))
  ) {
    const previousTokens = currentToken.getPreviousUntil(SQLTokenTypes.Keyword, [], normalizedPreviousKeywordValue);
    const numPredicateOperators =
      previousTokens?.filter((token) => PREDICATE_OPERATORS.includes(token.value.toUpperCase())).length || 0;
    const numLogicalOperators =
      previousTokens?.filter((token) => LOGICAL_OPERATORS.includes(token.value.toUpperCase())).length || 0;

    if (numPredicateOperators - numLogicalOperators === 0) {
      switch (normalizedPreviousKeywordValue) {
        case WHERE:
          return StatementPosition.WhereComparisonOperator;
        case HAVING:
          return StatementPosition.HavingComparisonOperator;
        case ON:
          return StatementPosition.OnComparisonOperator;
        case CASE:
          return StatementPosition.CaseComparisonOperator;
        case WHEN:
          return StatementPosition.WhenComparisonOperator;
      }
    } else {
      switch (normalizedPreviousKeywordValue) {
        case WHERE:
          return StatementPosition.AfterWhereValue;
        case HAVING:
          return StatementPosition.AfterHavingValue;
        case ON:
          return StatementPosition.AfterOnValue;
        case CASE:
          return StatementPosition.AfterCaseValue;
        case WHEN:
          return StatementPosition.AfterWhenValue;
      }
    }
  }

  if (
    [NULL, TRUE, FALSE].includes(normalizedPreviousKeywordValue) &&
    PREDICATE_OPERATORS.includes(previousKeyword?.getPreviousNonWhiteSpaceToken()?.value.toUpperCase() || '')
  ) {
    let nearestPreviousKeyword = previousKeyword?.getPreviousKeyword();
    let normalizedNearestPreviousKeywordValue = nearestPreviousKeyword?.value.toUpperCase() || '';
    while (![WHERE, HAVING, ON, CASE, WHEN].includes(normalizedNearestPreviousKeywordValue)) {
      nearestPreviousKeyword = nearestPreviousKeyword?.getPreviousKeyword();
      normalizedNearestPreviousKeywordValue = nearestPreviousKeyword?.value.toUpperCase() || '';
    }

    const previousTokens = currentToken.getPreviousUntil(
      SQLTokenTypes.Keyword,
      [],
      normalizedNearestPreviousKeywordValue
    );
    const numPredicateOperators =
      previousTokens?.filter((token) => PREDICATE_OPERATORS.includes(token.value.toUpperCase())).length || 0;
    const numLogicalOperators =
      previousTokens?.filter((token) => LOGICAL_OPERATORS.includes(token.value.toUpperCase())).length || 0;

    if (numPredicateOperators - numLogicalOperators === 0) {
      switch (normalizedNearestPreviousKeywordValue) {
        case WHERE:
          return StatementPosition.WhereComparisonOperator;
        case HAVING:
          return StatementPosition.HavingComparisonOperator;
        case ON:
          return StatementPosition.OnComparisonOperator;
        case CASE:
          return StatementPosition.CaseComparisonOperator;
        case WHEN:
          return StatementPosition.WhenComparisonOperator;
      }
    } else {
      switch (normalizedNearestPreviousKeywordValue) {
        case WHERE:
          return StatementPosition.AfterWhereValue;
        case HAVING:
          return StatementPosition.AfterHavingValue;
        case ON:
          return StatementPosition.AfterOnValue;
        case CASE:
          return StatementPosition.AfterCaseValue;
        case WHEN:
          return StatementPosition.AfterWhenValue;
      }
    }
  }

  if (currentToken.isWhiteSpace() && normalizedPreviousNonWhiteSpaceValue === THEN) {
    return StatementPosition.ThenExpression;
  }

  if (
    currentToken.isWhiteSpace() &&
    normalizedPreviousKeywordValue === THEN &&
    normalizedPreviousNonWhiteSpaceValue !== THEN
  ) {
    return StatementPosition.AfterThenExpression;
  }

  if (currentToken.isWhiteSpace() && normalizedPreviousNonWhiteSpaceValue === ELSE) {
    return StatementPosition.AfterElseKeyword;
  }

  if (normalizedPreviousNonWhiteSpaceValue === END && currentToken.isWhiteSpace()) {
    let nearestCaseKeyword = previousKeyword;
    while (CASE !== nearestCaseKeyword?.value.toUpperCase()) {
      nearestCaseKeyword = nearestCaseKeyword?.getPreviousKeyword();
    }
    const nearestKeywordBeforeCaseKeywordValue = nearestCaseKeyword.getPreviousKeyword()?.value.toUpperCase() || '';
    switch (nearestKeywordBeforeCaseKeywordValue) {
      case SELECT:
        return StatementPosition.AfterSelectExpression;
      case WHERE:
        return StatementPosition.AfterWhereValue;
    }
  }

  if (
    normalizedPreviousKeywordValue === BY &&
    previousKeyword?.getPreviousKeyword()?.value.toUpperCase() === GROUP &&
    (previousNonWhiteSpace?.value.toUpperCase() === BY || previousNonWhiteSpace?.is(SQLTokenTypes.Delimiter, ','))
  ) {
    return StatementPosition.AfterGroupByKeywords;
  }

  if (
    normalizedPreviousKeywordValue === BY &&
    previousKeyword?.getPreviousKeyword()?.value.toUpperCase() === GROUP &&
    (previousNonWhiteSpace?.isIdentifier() ||
      previousNonWhiteSpace?.is(SQLTokenTypes.Parenthesis, ')') ||
      previousNonWhiteSpace?.is(SQLTokenTypes.Parenthesis, '()'))
  ) {
    return StatementPosition.AfterGroupBy;
  }

  if (normalizedPreviousKeywordValue === BY && previousKeyword?.getPreviousKeyword()?.value.toUpperCase() === ORDER) {
    return StatementPosition.AfterOrderByKeywords;
  }

  if ([DESC, ASC].includes(normalizedPreviousKeywordValue)) {
    return StatementPosition.AfterOrderByDirection;
  }

  return StatementPosition.Unknown;
}
