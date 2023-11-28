import { StatementPosition } from '../../monarch/types';
import { DISPLAY, FIELDS, FILTER, STATS, SORT, LIMIT, PARSE, DEDUP, LOGS_COMMANDS, LOGS_FUNCTION_OPERATORS, LOGS_LOGIC_OPERATORS, } from '../language';
import { LogsTokenTypes } from './types';
export const getStatementPosition = (currentToken) => {
    var _a, _b, _c, _d;
    const previousNonWhiteSpace = currentToken === null || currentToken === void 0 ? void 0 : currentToken.getPreviousNonWhiteSpaceToken();
    const nextNonWhiteSpace = currentToken === null || currentToken === void 0 ? void 0 : currentToken.getNextNonWhiteSpaceToken();
    const normalizedCurrentToken = (_a = currentToken === null || currentToken === void 0 ? void 0 : currentToken.value) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    const normalizedPreviousNonWhiteSpace = (_b = previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.value) === null || _b === void 0 ? void 0 : _b.toLowerCase();
    if (currentToken === null || currentToken === void 0 ? void 0 : currentToken.is(LogsTokenTypes.Comment)) {
        return StatementPosition.Comment;
    }
    if (currentToken === null || currentToken === void 0 ? void 0 : currentToken.isFunction()) {
        return StatementPosition.Function;
    }
    if (currentToken === null ||
        ((currentToken === null || currentToken === void 0 ? void 0 : currentToken.isWhiteSpace()) && previousNonWhiteSpace === null && nextNonWhiteSpace === null) ||
        ((previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.is(LogsTokenTypes.Delimiter, '|')) && (currentToken === null || currentToken === void 0 ? void 0 : currentToken.isWhiteSpace())) ||
        ((currentToken === null || currentToken === void 0 ? void 0 : currentToken.isIdentifier()) &&
            ((previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.is(LogsTokenTypes.Delimiter, '|')) || previousNonWhiteSpace === null))) {
        return StatementPosition.NewCommand;
    }
    if ((currentToken === null || currentToken === void 0 ? void 0 : currentToken.is(LogsTokenTypes.Delimiter, ')')) ||
        ((currentToken === null || currentToken === void 0 ? void 0 : currentToken.isWhiteSpace()) && (previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.is(LogsTokenTypes.Delimiter, ')')))) {
        const openingParenthesis = currentToken === null || currentToken === void 0 ? void 0 : currentToken.getPreviousOfType(LogsTokenTypes.Delimiter, '(');
        const normalizedNonWhitespacePreceedingOpeningParenthesis = (_d = (_c = openingParenthesis === null || openingParenthesis === void 0 ? void 0 : openingParenthesis.getPreviousNonWhiteSpaceToken()) === null || _c === void 0 ? void 0 : _c.value) === null || _d === void 0 ? void 0 : _d.toLowerCase();
        if (normalizedNonWhitespacePreceedingOpeningParenthesis) {
            if (LOGS_COMMANDS.includes(normalizedNonWhitespacePreceedingOpeningParenthesis)) {
                return StatementPosition.AfterCommand;
            }
            if (LOGS_FUNCTION_OPERATORS.includes(normalizedNonWhitespacePreceedingOpeningParenthesis)) {
                return StatementPosition.AfterFunction;
            }
        }
    }
    if ((currentToken === null || currentToken === void 0 ? void 0 : currentToken.isKeyword()) && normalizedCurrentToken) {
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
    if ((currentToken === null || currentToken === void 0 ? void 0 : currentToken.isWhiteSpace()) && (previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.isKeyword) && normalizedPreviousNonWhiteSpace) {
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
    if ((currentToken === null || currentToken === void 0 ? void 0 : currentToken.is(LogsTokenTypes.Operator)) && normalizedCurrentToken) {
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
    if ((previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.is(LogsTokenTypes.Operator)) && normalizedPreviousNonWhiteSpace) {
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
    if ((currentToken === null || currentToken === void 0 ? void 0 : currentToken.isIdentifier()) ||
        (currentToken === null || currentToken === void 0 ? void 0 : currentToken.isNumber()) ||
        (currentToken === null || currentToken === void 0 ? void 0 : currentToken.is(LogsTokenTypes.Parenthesis, '()')) ||
        (currentToken === null || currentToken === void 0 ? void 0 : currentToken.is(LogsTokenTypes.Delimiter, ',')) ||
        (currentToken === null || currentToken === void 0 ? void 0 : currentToken.is(LogsTokenTypes.Parenthesis, ')')) ||
        ((currentToken === null || currentToken === void 0 ? void 0 : currentToken.isWhiteSpace()) && (previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.is(LogsTokenTypes.Delimiter, ','))) ||
        ((currentToken === null || currentToken === void 0 ? void 0 : currentToken.isWhiteSpace()) && (previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.isIdentifier())) ||
        ((currentToken === null || currentToken === void 0 ? void 0 : currentToken.isWhiteSpace()) &&
            (previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.isKeyword()) &&
            normalizedPreviousNonWhiteSpace &&
            LOGS_COMMANDS.includes(normalizedPreviousNonWhiteSpace))) {
        const nearestKeyword = currentToken === null || currentToken === void 0 ? void 0 : currentToken.getPreviousOfType(LogsTokenTypes.Keyword);
        const nearestFunction = currentToken === null || currentToken === void 0 ? void 0 : currentToken.getPreviousOfType(LogsTokenTypes.Function);
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
            if (nearestKeyword.range.startLineNumber > nearestFunction.range.startLineNumber ||
                nearestKeyword.range.endColumn > nearestFunction.range.endColumn) {
                if (nearestKeyword.value === SORT) {
                    return StatementPosition.SortArg;
                }
                if (nearestKeyword.value === FILTER) {
                    return StatementPosition.FilterArg;
                }
                return StatementPosition.CommandArg;
            }
            if (nearestFunction.range.startLineNumber > nearestKeyword.range.startLineNumber ||
                nearestFunction.range.endColumn > nearestKeyword.range.endColumn) {
                return StatementPosition.FunctionArg;
            }
        }
    }
    return StatementPosition.Unknown;
};
//# sourceMappingURL=statementPosition.js.map