import { StatementPosition, TokenType } from '../types';

import { AND, AS, ASC, BY, DESC, FROM, GROUP, ORDER, SELECT, WHERE, WITH } from './language';
import { StatementPositionResolversRegistryItem } from './types';

export function initStatementPositionResolvers(): StatementPositionResolversRegistryItem[] {
  return [
    {
      id: StatementPosition.SelectKeyword,
      name: StatementPosition.SelectKeyword,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) =>
        Boolean(
          currentToken === null ||
            (currentToken.isWhiteSpace() && currentToken.previous === null) ||
            currentToken.is(TokenType.Keyword, SELECT) ||
            (currentToken.is(TokenType.Keyword, SELECT) && currentToken.previous === null) ||
            previousIsSlash ||
            (currentToken.isIdentifier() && (previousIsSlash || currentToken?.previous === null)) ||
            (currentToken.isIdentifier() && SELECT.startsWith(currentToken.value.toLowerCase()))
        ),
    },
    {
      id: StatementPosition.WithKeyword,
      name: StatementPosition.WithKeyword,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) =>
        Boolean(
          currentToken === null ||
            (currentToken.isWhiteSpace() && currentToken.previous === null) ||
            (currentToken.is(TokenType.Keyword, WITH) && currentToken.previous === null) ||
            (currentToken.isIdentifier() && WITH.toLowerCase().startsWith(currentToken.value.toLowerCase()))
        ),
    },
    {
      id: StatementPosition.AfterSelectKeyword,
      name: StatementPosition.AfterSelectKeyword,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) =>
        Boolean(previousNonWhiteSpace?.value.toLowerCase() === SELECT),
    },
    {
      id: StatementPosition.AfterSelectArguments,
      name: StatementPosition.AfterSelectArguments,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) => {
        return Boolean(previousKeyword?.value.toLowerCase() === SELECT && previousNonWhiteSpace?.value === ',');
      },
    },
    {
      id: StatementPosition.AfterSelectFuncFirstArgument,
      name: StatementPosition.AfterSelectFuncFirstArgument,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) => {
        return Boolean(
          (previousKeyword?.value.toLowerCase() === SELECT || previousKeyword?.value.toLowerCase() === AS) &&
            (previousNonWhiteSpace?.is(TokenType.Parenthesis, '(') || currentToken?.is(TokenType.Parenthesis, '()'))
        );
      },
    },
    {
      id: StatementPosition.AfterWhereFunctionArgument,
      name: StatementPosition.AfterWhereFunctionArgument,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) => {
        return Boolean(
          previousKeyword?.is(TokenType.Keyword, WHERE) &&
            (previousNonWhiteSpace?.is(TokenType.Parenthesis, '(') || currentToken?.is(TokenType.Parenthesis, '()'))
        );
      },
    },
    {
      id: StatementPosition.AfterGroupBy,
      name: StatementPosition.AfterGroupBy,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) =>
        Boolean(
          previousKeyword?.is(TokenType.Keyword, BY) &&
            previousKeyword?.getPreviousKeyword()?.is(TokenType.Keyword, GROUP) &&
            (previousNonWhiteSpace?.isIdentifier() ||
              previousNonWhiteSpace?.isDoubleQuotedString() ||
              previousNonWhiteSpace?.is(TokenType.Parenthesis, ')') ||
              previousNonWhiteSpace?.is(TokenType.Parenthesis, '()'))
        ),
    },
    {
      id: StatementPosition.SelectAlias,
      name: StatementPosition.SelectAlias,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) => {
        if (previousNonWhiteSpace?.value === ',' && previousKeyword?.value.toLowerCase() === AS) {
          return true;
        }

        return false;
      },
    },

    {
      id: StatementPosition.FromKeyword,
      name: StatementPosition.FromKeyword,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) => {
        return Boolean(
          (previousKeyword?.value.toLowerCase() === SELECT && previousNonWhiteSpace?.value !== ',') ||
            ((currentToken?.isKeyword() || currentToken?.isIdentifier()) &&
              FROM.toLowerCase().startsWith(currentToken.value.toLowerCase()))
        );
      },
    },
    {
      id: StatementPosition.AfterFromKeyword,
      name: StatementPosition.AfterFromKeyword,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) =>
        Boolean(previousNonWhiteSpace?.value.toLowerCase() === FROM),
    },
    {
      id: StatementPosition.AfterFrom,
      name: StatementPosition.AfterFrom,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) =>
        Boolean(
          (previousKeyword?.value.toLowerCase() === FROM && previousNonWhiteSpace?.isDoubleQuotedString()) ||
            (previousKeyword?.value.toLowerCase() === FROM && previousNonWhiteSpace?.isIdentifier()) ||
            (previousKeyword?.value.toLowerCase() === FROM && previousNonWhiteSpace?.isVariable())
        ),
    },
    {
      id: StatementPosition.AfterTable,
      name: StatementPosition.AfterTable,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) => {
        return Boolean(
          previousKeyword?.value.toLowerCase() === FROM &&
            (previousNonWhiteSpace?.isVariable() || previousNonWhiteSpace?.value !== '')
        );
      },
    },
    {
      id: StatementPosition.WhereKeyword,
      name: StatementPosition.WhereKeyword,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) =>
        Boolean(
          previousKeyword?.value.toLowerCase() === WHERE &&
            (previousNonWhiteSpace?.isKeyword() ||
              previousNonWhiteSpace?.is(TokenType.Parenthesis, '(') ||
              previousNonWhiteSpace?.is(TokenType.Operator, AND))
        ),
    },
    {
      id: StatementPosition.WhereComparisonOperator,
      name: StatementPosition.WhereComparisonOperator,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) =>
        Boolean(
          previousKeyword?.value.toLowerCase() === WHERE &&
            !previousNonWhiteSpace?.getPreviousNonWhiteSpaceToken()?.isOperator() &&
            !currentToken?.is(TokenType.Delimiter, '.') &&
            !currentToken?.isParenthesis() &&
            (previousNonWhiteSpace?.isIdentifier() || previousNonWhiteSpace?.isDoubleQuotedString())
        ),
    },
    {
      id: StatementPosition.WhereValue,
      name: StatementPosition.WhereValue,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) =>
        Boolean(previousKeyword?.value.toLowerCase() === WHERE && previousNonWhiteSpace?.isOperator()),
    },
    {
      id: StatementPosition.AfterWhereValue,
      name: StatementPosition.AfterWhereValue,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) => {
        return Boolean(
          previousKeyword?.value.toLowerCase() === WHERE &&
            (previousNonWhiteSpace?.is(TokenType.Operator, 'and') ||
              previousNonWhiteSpace?.is(TokenType.Operator, 'or') ||
              previousNonWhiteSpace?.isString() ||
              previousNonWhiteSpace?.isNumber() ||
              previousNonWhiteSpace?.is(TokenType.Parenthesis, ')') ||
              previousNonWhiteSpace?.is(TokenType.Parenthesis, '()') ||
              previousNonWhiteSpace?.isTemplateVariable() ||
              (previousNonWhiteSpace?.is(TokenType.IdentifierQuote) &&
                previousNonWhiteSpace.getPreviousNonWhiteSpaceToken()?.is(TokenType.Identifier) &&
                previousNonWhiteSpace
                  ?.getPreviousNonWhiteSpaceToken()
                  ?.getPreviousNonWhiteSpaceToken()
                  ?.is(TokenType.IdentifierQuote)))
        );
      },
    },
    {
      id: StatementPosition.AfterGroupByKeywords,
      name: StatementPosition.AfterGroupByKeywords,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) =>
        Boolean(
          previousKeyword?.is(TokenType.Keyword, BY) &&
            previousKeyword?.getPreviousKeyword()?.is(TokenType.Keyword, GROUP) &&
            (previousNonWhiteSpace?.is(TokenType.Keyword, BY) || previousNonWhiteSpace?.is(TokenType.Delimiter, ','))
        ),
    },
    {
      id: StatementPosition.AfterGroupByFunctionArgument,
      name: StatementPosition.AfterGroupByFunctionArgument,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) => {
        return Boolean(
          previousKeyword?.is(TokenType.Keyword, BY) &&
            previousKeyword?.getPreviousKeyword()?.is(TokenType.Keyword, GROUP) &&
            (previousNonWhiteSpace?.is(TokenType.Parenthesis, '(') || currentToken?.is(TokenType.Parenthesis, '()'))
        );
      },
    },
    {
      id: StatementPosition.AfterOrderByKeywords,
      name: StatementPosition.AfterOrderByKeywords,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) =>
        Boolean(
          previousNonWhiteSpace?.is(TokenType.Keyword, BY) &&
            previousNonWhiteSpace?.getPreviousKeyword()?.is(TokenType.Keyword, ORDER)
        ),
    },
    {
      id: StatementPosition.AfterOrderByFunction,
      name: StatementPosition.AfterOrderByFunction,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) =>
        Boolean(
          previousKeyword?.is(TokenType.Keyword, BY) &&
            previousKeyword?.getPreviousKeyword()?.is(TokenType.Keyword, ORDER) &&
            previousNonWhiteSpace?.is(TokenType.Parenthesis) &&
            previousNonWhiteSpace?.getPreviousNonWhiteSpaceToken()?.is(TokenType.Function)
        ),
    },
    {
      id: StatementPosition.AfterOrderByDirection,
      name: StatementPosition.AfterOrderByDirection,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) =>
        Boolean(previousKeyword?.is(TokenType.Keyword, DESC) || previousKeyword?.is(TokenType.Keyword, ASC)),
    },
    {
      id: StatementPosition.AfterIsOperator,
      name: StatementPosition.AfterIsOperator,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) => {
        return Boolean(previousNonWhiteSpace?.is(TokenType.Operator, 'IS'));
      },
    },
    {
      id: StatementPosition.AfterIsNotOperator,
      name: StatementPosition.AfterIsNotOperator,
      resolve: (currentToken, previousKeyword, previousNonWhiteSpace, previousIsSlash) => {
        return Boolean(
          previousNonWhiteSpace?.is(TokenType.Operator, 'NOT') &&
            previousNonWhiteSpace.getPreviousNonWhiteSpaceToken()?.is(TokenType.Operator, 'IS')
        );
      },
    },
  ];
}
