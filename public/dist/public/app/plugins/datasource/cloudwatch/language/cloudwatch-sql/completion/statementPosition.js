import { StatementPosition } from '../../monarch/types';
import { AND, ASC, BY, DESC, EQUALS, FROM, GROUP, NOT_EQUALS, ORDER, SCHEMA, SELECT, WHERE } from '../language';
import { SQLTokenTypes } from './types';
export function getStatementPosition(currentToken) {
    var _a, _b, _c, _d, _e, _f;
    const previousNonWhiteSpace = currentToken === null || currentToken === void 0 ? void 0 : currentToken.getPreviousNonWhiteSpaceToken();
    const previousKeyword = currentToken === null || currentToken === void 0 ? void 0 : currentToken.getPreviousKeyword();
    const previousIsSlash = (_a = currentToken === null || currentToken === void 0 ? void 0 : currentToken.getPreviousNonWhiteSpaceToken()) === null || _a === void 0 ? void 0 : _a.is(SQLTokenTypes.Operator, '/');
    if (currentToken === null ||
        (currentToken.isWhiteSpace() && currentToken.previous === null) ||
        (currentToken.is(SQLTokenTypes.Keyword, SELECT) && currentToken.previous === null) ||
        previousIsSlash ||
        (currentToken.isIdentifier() && (previousIsSlash || (currentToken === null || currentToken === void 0 ? void 0 : currentToken.previous) === null))) {
        return StatementPosition.SelectKeyword;
    }
    if ((previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.value) === SELECT) {
        return StatementPosition.AfterSelectKeyword;
    }
    if (((previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.is(SQLTokenTypes.Parenthesis, '(')) || (currentToken === null || currentToken === void 0 ? void 0 : currentToken.is(SQLTokenTypes.Parenthesis, '()'))) &&
        (previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.value) === SELECT) {
        return StatementPosition.AfterSelectFuncFirstArgument;
    }
    if ((previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.value) === SELECT && (previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.isParenthesis())) {
        return StatementPosition.FromKeyword;
    }
    if ((previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.value) === FROM) {
        return StatementPosition.AfterFromKeyword;
    }
    if (((previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.is(SQLTokenTypes.Parenthesis, '(')) || (currentToken === null || currentToken === void 0 ? void 0 : currentToken.is(SQLTokenTypes.Parenthesis, '()'))) &&
        (previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.value) === SCHEMA) {
        return StatementPosition.SchemaFuncFirstArgument;
    }
    if ((previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.value) === SCHEMA && (previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.is(SQLTokenTypes.Delimiter, ','))) {
        return StatementPosition.SchemaFuncExtraArgument;
    }
    if (((previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.value) === FROM && (previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.isDoubleQuotedString())) ||
        ((previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.value) === FROM && (previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.isVariable())) ||
        ((previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.value) === SCHEMA && (previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.is(SQLTokenTypes.Parenthesis, ')')))) {
        return StatementPosition.AfterFrom;
    }
    if ((previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.value) === WHERE &&
        ((previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.isKeyword()) ||
            (previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.is(SQLTokenTypes.Parenthesis, '(')) ||
            (previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.is(SQLTokenTypes.Operator, AND)))) {
        return StatementPosition.WhereKey;
    }
    if ((previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.value) === WHERE &&
        ((previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.isIdentifier()) || (previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.isDoubleQuotedString()))) {
        return StatementPosition.WhereComparisonOperator;
    }
    if ((previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.value) === WHERE &&
        ((previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.is(SQLTokenTypes.Operator, EQUALS)) ||
            (previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.is(SQLTokenTypes.Operator, NOT_EQUALS)))) {
        return StatementPosition.WhereValue;
    }
    if ((previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.value) === WHERE &&
        ((previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.isString()) || (previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.is(SQLTokenTypes.Parenthesis, ')')))) {
        return StatementPosition.AfterWhereValue;
    }
    if ((previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.is(SQLTokenTypes.Keyword, BY)) &&
        ((_b = previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.getPreviousKeyword()) === null || _b === void 0 ? void 0 : _b.is(SQLTokenTypes.Keyword, GROUP)) &&
        ((previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.is(SQLTokenTypes.Keyword, BY)) || (previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.is(SQLTokenTypes.Delimiter, ',')))) {
        return StatementPosition.AfterGroupByKeywords;
    }
    if ((previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.is(SQLTokenTypes.Keyword, BY)) &&
        ((_c = previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.getPreviousKeyword()) === null || _c === void 0 ? void 0 : _c.is(SQLTokenTypes.Keyword, GROUP)) &&
        ((previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.isIdentifier()) || (previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.isDoubleQuotedString()))) {
        return StatementPosition.AfterGroupBy;
    }
    if ((previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.is(SQLTokenTypes.Keyword, BY)) &&
        ((_d = previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.getPreviousKeyword()) === null || _d === void 0 ? void 0 : _d.is(SQLTokenTypes.Keyword, ORDER))) {
        return StatementPosition.AfterOrderByKeywords;
    }
    if ((previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.is(SQLTokenTypes.Keyword, BY)) &&
        ((_e = previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.getPreviousKeyword()) === null || _e === void 0 ? void 0 : _e.is(SQLTokenTypes.Keyword, ORDER)) &&
        (previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.is(SQLTokenTypes.Parenthesis)) &&
        ((_f = previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.getPreviousNonWhiteSpaceToken()) === null || _f === void 0 ? void 0 : _f.is(SQLTokenTypes.Function))) {
        return StatementPosition.AfterOrderByFunction;
    }
    if ((previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.is(SQLTokenTypes.Keyword, DESC)) || (previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.is(SQLTokenTypes.Keyword, ASC))) {
        return StatementPosition.AfterOrderByDirection;
    }
    return StatementPosition.Unknown;
}
//# sourceMappingURL=statementPosition.js.map