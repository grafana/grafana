import { LinkedToken } from '../../monarch/LinkedToken';
import { StatementPosition } from '../../monarch/types';
import {
  DISPLAY,
  FIELDS,
  FILTER,
  STATS,
  SORT,
  LIMIT,
  PARSE,
  DEDUP,
  LOGS_COMMANDS,
  LOGS_FUNCTION_OPERATORS,
  LOGS_LOGIC_OPERATORS,
} from '../language';

import { LogsTokenTypes } from './types';

// about getStatementPosition: public/app/plugins/datasource/cloudwatch/language/cloudwatch-ppl/completion/statementPosition.ts

export const getStatementPosition = (currentToken: LinkedToken | null): StatementPosition => {
  const previousNonWhiteSpace = currentToken?.getPreviousNonWhiteSpaceToken();
  const nextNonWhiteSpace = currentToken?.getNextNonWhiteSpaceToken();

  const normalizedCurrentToken = currentToken?.value?.toLowerCase();
  const normalizedPreviousNonWhiteSpace = previousNonWhiteSpace?.value?.toLowerCase();

  if (currentToken?.is(LogsTokenTypes.Comment)) {
    return StatementPosition.Comment;
  }

  if (currentToken?.isFunction()) {
    return StatementPosition.Function;
  }

  if (
    currentToken === null ||
    (currentToken?.isWhiteSpace() && previousNonWhiteSpace === null && nextNonWhiteSpace === null) ||
    (previousNonWhiteSpace?.is(LogsTokenTypes.Delimiter, '|') && currentToken?.isWhiteSpace()) ||
    (currentToken?.isIdentifier() &&
      (previousNonWhiteSpace?.is(LogsTokenTypes.Delimiter, '|') || previousNonWhiteSpace === null))
  ) {
    return StatementPosition.NewCommand;
  }

  if (
    currentToken?.is(LogsTokenTypes.Delimiter, ')') ||
    (currentToken?.isWhiteSpace() && previousNonWhiteSpace?.is(LogsTokenTypes.Delimiter, ')'))
  ) {
    const openingParenthesis = currentToken?.getPreviousOfType(LogsTokenTypes.Delimiter, '(');
    const normalizedNonWhitespacePreceedingOpeningParenthesis = openingParenthesis
      ?.getPreviousNonWhiteSpaceToken()
      ?.value?.toLowerCase();

    if (normalizedNonWhitespacePreceedingOpeningParenthesis) {
      if (LOGS_COMMANDS.includes(normalizedNonWhitespacePreceedingOpeningParenthesis)) {
        return StatementPosition.AfterCommand;
      }
      if (LOGS_FUNCTION_OPERATORS.includes(normalizedNonWhitespacePreceedingOpeningParenthesis)) {
        return StatementPosition.AfterFunction;
      }
    }
  }

  if (currentToken?.isKeyword() && normalizedCurrentToken) {
    switch (normalizedCurrentToken) {
      case DEDUP:
        return StatementPosition.DedupKeyword;
      case DISPLAY:
        return StatementPosition.DisplayKeyword;
      case FIELDS:
        return StatementPosition.FieldsKeyword;
      case FILTER:
        return StatementPosition.FilterKeyword;
      case LIMIT:
        return StatementPosition.LimitKeyword;
      case PARSE:
        return StatementPosition.ParseKeyword;
      case STATS:
        return StatementPosition.StatsKeyword;
      case SORT:
        return StatementPosition.SortKeyword;
      case 'as':
        return StatementPosition.AsKeyword;
      case 'by':
        return StatementPosition.ByKeyword;
      case 'in':
        return StatementPosition.InKeyword;
      case 'like':
        return StatementPosition.LikeKeyword;
    }
  }

  if (currentToken?.isWhiteSpace() && previousNonWhiteSpace?.isKeyword && normalizedPreviousNonWhiteSpace) {
    switch (normalizedPreviousNonWhiteSpace) {
      case DEDUP:
        return StatementPosition.AfterDedupKeyword;
      case DISPLAY:
        return StatementPosition.AfterDisplayKeyword;
      case FIELDS:
        return StatementPosition.AfterFieldsKeyword;
      case FILTER:
        return StatementPosition.AfterFilterKeyword;
      case LIMIT:
        return StatementPosition.AfterLimitKeyword;
      case PARSE:
        return StatementPosition.AfterParseKeyword;
      case STATS:
        return StatementPosition.AfterStatsKeyword;
      case SORT:
        return StatementPosition.AfterSortKeyword;
      case 'as':
        return StatementPosition.AfterAsKeyword;
      case 'by':
        return StatementPosition.AfterByKeyword;
      case 'in':
        return StatementPosition.AfterInKeyword;
      case 'like':
        return StatementPosition.AfterLikeKeyword;
    }
  }

  if (currentToken?.is(LogsTokenTypes.Operator) && normalizedCurrentToken) {
    if (['+', '-', '*', '/', '^', '%'].includes(normalizedCurrentToken)) {
      return StatementPosition.ArithmeticOperator;
    }

    if (['=', '!=', '<', '>', '<=', '>='].includes(normalizedCurrentToken)) {
      return StatementPosition.ComparisonOperator;
    }

    if (LOGS_LOGIC_OPERATORS.includes(normalizedCurrentToken)) {
      return StatementPosition.BooleanOperator;
    }
  }

  if (previousNonWhiteSpace?.is(LogsTokenTypes.Operator) && normalizedPreviousNonWhiteSpace) {
    if (['+', '-', '*', '/', '^', '%'].includes(normalizedPreviousNonWhiteSpace)) {
      return StatementPosition.ArithmeticOperatorArg;
    }

    if (['=', '!=', '<', '>', '<=', '>='].includes(normalizedPreviousNonWhiteSpace)) {
      return StatementPosition.ComparisonOperatorArg;
    }

    if (LOGS_LOGIC_OPERATORS.includes(normalizedPreviousNonWhiteSpace)) {
      return StatementPosition.BooleanOperatorArg;
    }
  }

  if (
    currentToken?.isIdentifier() ||
    currentToken?.isNumber() ||
    currentToken?.is(LogsTokenTypes.Parenthesis, '()') ||
    currentToken?.is(LogsTokenTypes.Delimiter, ',') ||
    currentToken?.is(LogsTokenTypes.Parenthesis, ')') ||
    (currentToken?.isWhiteSpace() && previousNonWhiteSpace?.is(LogsTokenTypes.Delimiter, ',')) ||
    (currentToken?.isWhiteSpace() && previousNonWhiteSpace?.isIdentifier()) ||
    (currentToken?.isWhiteSpace() &&
      previousNonWhiteSpace?.isKeyword() &&
      normalizedPreviousNonWhiteSpace &&
      LOGS_COMMANDS.includes(normalizedPreviousNonWhiteSpace))
  ) {
    const nearestKeyword = currentToken?.getPreviousOfType(LogsTokenTypes.Keyword);
    const nearestFunction = currentToken?.getPreviousOfType(LogsTokenTypes.Function);

    if (nearestKeyword !== null && nearestFunction === null) {
      if (nearestKeyword.value === SORT) {
        return StatementPosition.SortArg;
      }
      if (nearestKeyword.value === FILTER) {
        return StatementPosition.FilterArg;
      }
      return StatementPosition.CommandArg;
    }

    if (nearestFunction !== null && nearestKeyword === null) {
      return StatementPosition.FunctionArg;
    }

    if (nearestKeyword !== null && nearestFunction !== null) {
      if (
        nearestKeyword.range.startLineNumber > nearestFunction.range.startLineNumber ||
        nearestKeyword.range.endColumn > nearestFunction.range.endColumn
      ) {
        if (nearestKeyword.value === SORT) {
          return StatementPosition.SortArg;
        }
        if (nearestKeyword.value === FILTER) {
          return StatementPosition.FilterArg;
        }
        return StatementPosition.CommandArg;
      }

      if (
        nearestFunction.range.startLineNumber > nearestKeyword.range.startLineNumber ||
        nearestFunction.range.endColumn > nearestKeyword.range.endColumn
      ) {
        return StatementPosition.FunctionArg;
      }
    }
  }

  return StatementPosition.Unknown;
};
