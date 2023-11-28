import { FROM, SCHEMA, SELECT } from '../language';
import { SQLTokenTypes } from './types';
export const getSelectToken = (currentToken) => { var _a; return (_a = currentToken === null || currentToken === void 0 ? void 0 : currentToken.getPreviousOfType(SQLTokenTypes.Keyword, SELECT)) !== null && _a !== void 0 ? _a : null; };
export const getSelectStatisticToken = (currentToken) => {
    var _a;
    const assumedStatisticToken = (_a = getSelectToken(currentToken)) === null || _a === void 0 ? void 0 : _a.getNextNonWhiteSpaceToken();
    return (assumedStatisticToken === null || assumedStatisticToken === void 0 ? void 0 : assumedStatisticToken.isVariable()) || (assumedStatisticToken === null || assumedStatisticToken === void 0 ? void 0 : assumedStatisticToken.isFunction()) ? assumedStatisticToken : null;
};
export const getMetricNameToken = (currentToken) => {
    var _a, _b;
    // statistic function is followed by `(` and then an argument
    const assumedMetricNameToken = (_b = (_a = getSelectStatisticToken(currentToken)) === null || _a === void 0 ? void 0 : _a.next) === null || _b === void 0 ? void 0 : _b.next;
    return (assumedMetricNameToken === null || assumedMetricNameToken === void 0 ? void 0 : assumedMetricNameToken.isVariable()) || (assumedMetricNameToken === null || assumedMetricNameToken === void 0 ? void 0 : assumedMetricNameToken.isIdentifier()) ? assumedMetricNameToken : null;
};
export const getFromKeywordToken = (currentToken) => {
    const selectToken = getSelectToken(currentToken);
    return selectToken === null || selectToken === void 0 ? void 0 : selectToken.getNextOfType(SQLTokenTypes.Keyword, FROM);
};
export const getNamespaceToken = (currentToken) => {
    var _a, _b;
    const fromToken = getFromKeywordToken(currentToken);
    const nextNonWhiteSpace = fromToken === null || fromToken === void 0 ? void 0 : fromToken.getNextNonWhiteSpaceToken();
    if ((nextNonWhiteSpace === null || nextNonWhiteSpace === void 0 ? void 0 : nextNonWhiteSpace.isDoubleQuotedString()) ||
        ((nextNonWhiteSpace === null || nextNonWhiteSpace === void 0 ? void 0 : nextNonWhiteSpace.isVariable()) && (nextNonWhiteSpace === null || nextNonWhiteSpace === void 0 ? void 0 : nextNonWhiteSpace.value.toUpperCase()) !== SCHEMA)) {
        // schema is not used
        return nextNonWhiteSpace;
    }
    else if ((nextNonWhiteSpace === null || nextNonWhiteSpace === void 0 ? void 0 : nextNonWhiteSpace.isKeyword()) && ((_a = nextNonWhiteSpace.next) === null || _a === void 0 ? void 0 : _a.is(SQLTokenTypes.Parenthesis, '('))) {
        // schema is specified
        const assumedNamespaceToken = (_b = nextNonWhiteSpace.next) === null || _b === void 0 ? void 0 : _b.next;
        if ((assumedNamespaceToken === null || assumedNamespaceToken === void 0 ? void 0 : assumedNamespaceToken.isDoubleQuotedString()) || (assumedNamespaceToken === null || assumedNamespaceToken === void 0 ? void 0 : assumedNamespaceToken.isVariable())) {
            return assumedNamespaceToken;
        }
    }
    return null;
};
//# sourceMappingURL=tokenUtils.js.map