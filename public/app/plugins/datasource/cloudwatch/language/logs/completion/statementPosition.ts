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
  LOGS_COMMANDS,
  LOGS_FUNCTION_OPERATORS,
  LOGS_LOGIC_OPERATORS,
} from '../language';

import { LogsTokenTypes } from './types';

// fields =>
//  fields @timestamp |
//  fields @timestamp, @message |
//  fields @timestamp, @message as msg |
// display =>
//  display @timestamp |
//  display @timestamp as tmstmp |
// filter =>
//  filter (range>3000) |
//  filter (range>3000 and accountId=123456789012) |
//  filter (range>3000 or accountId=123456789012) |
//  filter logGroup in ["example_group"] |
//  filter logGroup not in ["example_group"] |
//  filter f1 like "Exception" |
//  filter f1 not like "Exception" |
//  filter f1 like /(?i)Exception/ |
//  filter f1 not like /(?i)Exception/ |
// stats =>
//  stats count(*) by @timestamp, bin(1h) |
// parse =>
//  parse @message "'fieldsA': '*', 'fieldsB': ['*']" as fld, array |
//  parse @message /(?<NetworkInterface>eni-.*?) | display @timestamp, NetworkInterface
// sort =>
//  sort asc
//  sort desc
//  sort @timestamp asc
//  sort @timestamp desc
//  sort @timestamp, @message asc
//  sort @timestamp, @message desc
// limit =>
//  limit 20
// unmask =>
//  fields @timestamp, unmask(@message) |

const d = (...args: Array<string | LinkedToken | null | undefined>) => console.log('getStatementPosition:', ...args);
// const d = (...args: Array<string | LinkedToken | null | undefined>) => {};

export const getStatementPosition = (currentToken: LinkedToken | null): StatementPosition => {
  const previousKeyword = currentToken?.getPreviousKeyword();
  const previousNonWhiteSpace = currentToken?.getPreviousNonWhiteSpaceToken();
  const nextNonWhiteSpace = currentToken?.getNextNonWhiteSpaceToken();

  const normalizedCurrentToken = currentToken?.value?.toLowerCase();
  const normalizedPreviousKeyword = previousKeyword?.value?.toLowerCase();
  const normalizedPreviousNonWhiteSpace = previousNonWhiteSpace?.value?.toLowerCase();

  d('currentToken', currentToken);
  d('previousKeyword', previousKeyword);
  d('previousNonWhiteSpace', previousNonWhiteSpace);

  if (currentToken?.is(LogsTokenTypes.Comment)) {
    d('(StatementPosition.Comment)');
    return StatementPosition.Comment;
  }

  if (currentToken?.isFunction()) {
    d('(StatementPosition.Function)');
    return StatementPosition.Function;
  }

  if (
    currentToken === null ||
    (currentToken?.isWhiteSpace() && previousNonWhiteSpace === null && nextNonWhiteSpace === null) ||
    (previousNonWhiteSpace?.is(LogsTokenTypes.Delimiter, '|') && currentToken?.isWhiteSpace()) ||
    (currentToken?.isIdentifier() &&
      (previousNonWhiteSpace?.is(LogsTokenTypes.Delimiter, '|') || previousNonWhiteSpace === null))
  ) {
    d('(StatementPosition.NewCommand)');
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
        d('(StatementPosition.AfterCommand)');
        return StatementPosition.AfterCommand;
      }
      if (LOGS_FUNCTION_OPERATORS.includes(normalizedNonWhitespacePreceedingOpeningParenthesis)) {
        d('(StatementPosition.AfterFunction)');
        return StatementPosition.AfterFunction;
      }
    }
  }

  if (currentToken?.isKeyword() && normalizedCurrentToken) {
    switch (normalizedCurrentToken) {
      case DISPLAY:
        d('(StatementPosition.DisplayKeyword)');
        return StatementPosition.DisplayKeyword;
      case FIELDS:
        d('(StatementPosition.FieldsKeyword)');
        return StatementPosition.FieldsKeyword;
      case FILTER:
        d('(StatementPosition.FilterKeyword)');
        return StatementPosition.FilterKeyword;
      case LIMIT:
        d('(StatementPosition.LimitKeyword)');
        return StatementPosition.LimitKeyword;
      case PARSE:
        d('(StatementPosition.ParseKeyword)');
        return StatementPosition.ParseKeyword;
      case STATS:
        d('(StatementPosition.StatsKeyword)');
        return StatementPosition.StatsKeyword;
      case SORT:
        d('(StatementPosition.SortKeyword)');
        return StatementPosition.SortKeyword;
      case 'as':
        d('(StatementPosition.AsKeyword)');
        return StatementPosition.AsKeyword;
      case 'by':
        d('(StatementPosition.ByKeyword)');
        return StatementPosition.ByKeyword;
      case 'in':
        d('(StatementPosition.InKeyword)');
        return StatementPosition.InKeyword;
      case 'like':
        d('(StatementPosition.LikeKeyword)');
        return StatementPosition.LikeKeyword;
    }
  }

  if (currentToken?.isWhiteSpace() && previousNonWhiteSpace?.isKeyword && normalizedPreviousNonWhiteSpace) {
    switch (normalizedPreviousNonWhiteSpace) {
      case DISPLAY:
        d('(StatementPosition.AfterDisplayKeyword)');
        return StatementPosition.AfterDisplayKeyword;
      case FIELDS:
        d('(StatementPosition.AfterFieldsKeyword)');
        return StatementPosition.AfterFieldsKeyword;
      case FILTER:
        d('(StatementPosition.AfterFilterKeyword)');
        return StatementPosition.AfterFilterKeyword;
      case LIMIT:
        d('(StatementPosition.AfterLimitKeyword)');
        return StatementPosition.AfterLimitKeyword;
      case PARSE:
        d('(StatementPosition.AfterParseKeyword)');
        return StatementPosition.AfterParseKeyword;
      case STATS:
        d('(StatementPosition.AfterStatsKeyword)');
        return StatementPosition.AfterStatsKeyword;
      case SORT:
        d('(StatementPosition.AfterSortKeyword)');
        return StatementPosition.AfterSortKeyword;
      case 'as':
        d('(StatementPosition.AfterAsKeyword)');
        return StatementPosition.AfterAsKeyword;
      case 'by':
        d('(StatementPosition.AfterByKeyword)');
        return StatementPosition.AfterByKeyword;
      case 'in':
        d('(StatementPosition.AfterInKeyword)');
        return StatementPosition.AfterInKeyword;
      case 'like':
        d('(StatementPosition.AfterLikeKeyword)');
        return StatementPosition.AfterLikeKeyword;
    }
  }

  if (currentToken?.is(LogsTokenTypes.Operator) && normalizedCurrentToken) {
    if (['+', '-', '*', '/', '^', '%'].includes(normalizedCurrentToken)) {
      d('(StatementPosition.ArithmeticOperator)');
      return StatementPosition.ArithmeticOperator;
    }

    if (['=', '!=', '<', '>', '<=', '>='].includes(normalizedCurrentToken)) {
      d('(StatementPosition.ComparisonOperator)');
      return StatementPosition.ComparisonOperator;
    }

    if (LOGS_LOGIC_OPERATORS.includes(normalizedCurrentToken)) {
      d('(StatementPosition.BooleanOperator)');
      return StatementPosition.BooleanOperator;
    }
  }

  if (previousNonWhiteSpace?.is(LogsTokenTypes.Operator) && normalizedPreviousNonWhiteSpace) {
    if (['+', '-', '*', '/', '^', '%'].includes(normalizedPreviousNonWhiteSpace)) {
      d('(StatementPosition.ArithmeticOperatorArg)');
      return StatementPosition.ArithmeticOperatorArg;
    }

    if (['=', '!=', '<', '>', '<=', '>='].includes(normalizedPreviousNonWhiteSpace)) {
      d('(StatementPosition.ComparisonOperatorArg)');
      return StatementPosition.ComparisonOperatorArg;
    }

    if (LOGS_LOGIC_OPERATORS.includes(normalizedPreviousNonWhiteSpace)) {
      d('(StatementPosition.BooleanOperatorArg)');
      return StatementPosition.BooleanOperatorArg;
    }
  }

  if (currentToken?.is(LogsTokenTypes.Regexp) && normalizedPreviousKeyword === PARSE) {
    d('(StatementPosition.ParseRegularExpression)');
    return StatementPosition.ParseRegularExpression;
  }

  if (
    currentToken?.isIdentifier() ||
    currentToken?.isNumber() ||
    currentToken?.is(LogsTokenTypes.Parenthesis, '()') ||
    currentToken?.is(LogsTokenTypes.Delimiter, ',') ||
    currentToken?.is(LogsTokenTypes.Parenthesis, ')') ||
    (currentToken?.isWhiteSpace() && previousNonWhiteSpace?.is(LogsTokenTypes.Delimiter, ','))
  ) {
    const nearestKeyword = currentToken?.getPreviousOfType(LogsTokenTypes.Keyword);
    const nearestFunction = currentToken?.getPreviousOfType(LogsTokenTypes.Function);

    if (nearestKeyword !== null && nearestFunction === null) {
      d('(StatementPosition.CommandArg)', '0');
      return StatementPosition.CommandArg;
    }

    if (nearestFunction !== null && nearestKeyword === null) {
      d('(StatementPosition.FunctionArg)', '0');
      return StatementPosition.FunctionArg;
    }

    if (nearestKeyword !== null && nearestFunction !== null) {
      if (nearestKeyword.range.startLineNumber > nearestFunction.range.startLineNumber) {
        d('(StatementPosition.CommandArg)', '1');
        return StatementPosition.CommandArg;
      }

      if (nearestFunction.range.startLineNumber > nearestKeyword.range.startLineNumber) {
        d('(StatementPosition.FunctionArg)', '2');
        return StatementPosition.FunctionArg;
      }

      if (nearestKeyword.range.endColumn > nearestFunction.range.endColumn) {
        d('(StatementPosition.CommandArg)', '3');
        return StatementPosition.CommandArg;
      }

      if (nearestFunction.range.endColumn > nearestKeyword.range.endColumn) {
        d('(StatementPosition.FunctionArg)', '4');
        return StatementPosition.FunctionArg;
      }
    }
  }

  d('getStatementPosition: (StatementPosition.Unknown)');
  return StatementPosition.Unknown;
};
