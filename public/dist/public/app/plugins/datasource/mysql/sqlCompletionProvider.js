import { __awaiter } from "tslib";
import { CompletionItemKind, CompletionItemPriority, getStandardSQLCompletionProvider, SuggestionKind, TokenType, } from '@grafana/experimental';
export const getSqlCompletionProvider = ({ getMeta }) => (monaco, language) => (Object.assign(Object.assign({}, (language && getStandardSQLCompletionProvider(monaco, language))), { customStatementPlacement: customStatementPlacementProvider, customSuggestionKinds: customSuggestionKinds(getMeta) }));
const customStatementPlacement = {
    afterDatabase: 'afterDatabase',
};
const customSuggestionKind = {
    tablesWithinDatabase: 'tablesWithinDatabase',
};
const FROMKEYWORD = 'FROM';
export const customStatementPlacementProvider = () => [
    {
        id: customStatementPlacement.afterDatabase,
        resolve: (currentToken, previousKeyword, previousNonWhiteSpace) => {
            var _a;
            return Boolean((currentToken === null || currentToken === void 0 ? void 0 : currentToken.is(TokenType.Delimiter, '.')) &&
                (previousKeyword === null || previousKeyword === void 0 ? void 0 : previousKeyword.value) === FROMKEYWORD &&
                ((previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.is(TokenType.IdentifierQuote)) || (previousNonWhiteSpace === null || previousNonWhiteSpace === void 0 ? void 0 : previousNonWhiteSpace.isIdentifier())) &&
                // don't match after table name
                ((_a = currentToken === null || currentToken === void 0 ? void 0 : currentToken.getPreviousUntil(TokenType.Keyword, [TokenType.IdentifierQuote], FROMKEYWORD)) === null || _a === void 0 ? void 0 : _a.filter((t) => t.isIdentifier()).length) === 1);
        },
    },
];
export const customSuggestionKinds = (getMeta) => () => [
    {
        id: SuggestionKind.Tables,
        overrideDefault: true,
        suggestionsResolver: (ctx) => __awaiter(void 0, void 0, void 0, function* () {
            const databaseName = getDatabaseName(ctx.currentToken);
            const suggestions = yield getMeta({ schema: databaseName });
            return suggestions.map(mapToSuggestion(ctx));
        }),
    },
    {
        id: SuggestionKind.Columns,
        overrideDefault: true,
        suggestionsResolver: (ctx) => __awaiter(void 0, void 0, void 0, function* () {
            const databaseToken = getDatabaseToken(ctx.currentToken);
            const databaseName = getDatabaseName(databaseToken);
            const tableName = getTableName(databaseToken);
            if (!databaseName || !tableName) {
                return [];
            }
            const suggestions = yield getMeta({ schema: databaseName, table: tableName });
            return suggestions.map(mapToSuggestion(ctx));
        }),
    },
    {
        id: customSuggestionKind.tablesWithinDatabase,
        applyTo: [customStatementPlacement.afterDatabase],
        suggestionsResolver: (ctx) => __awaiter(void 0, void 0, void 0, function* () {
            const databaseName = getDatabaseName(ctx.currentToken);
            const suggestions = yield getMeta({ schema: databaseName });
            return suggestions.map(mapToSuggestion(ctx));
        }),
    },
];
function mapToSuggestion(ctx) {
    return function (tableDefinition) {
        var _a;
        return {
            label: tableDefinition.name,
            insertText: (_a = tableDefinition.completion) !== null && _a !== void 0 ? _a : tableDefinition.name,
            command: { id: 'editor.action.triggerSuggest', title: '' },
            kind: CompletionItemKind.Field,
            sortText: CompletionItemPriority.High,
            range: Object.assign(Object.assign({}, ctx.range), { startColumn: ctx.range.endColumn, endColumn: ctx.range.endColumn }),
        };
    };
}
function getDatabaseName(token) {
    var _a, _b, _c;
    if ((token === null || token === void 0 ? void 0 : token.isIdentifier()) && token.value[token.value.length - 1] !== '.') {
        return token.value;
    }
    if (token === null || token === void 0 ? void 0 : token.is(TokenType.Delimiter, '.')) {
        return (_a = token.getPreviousOfType(TokenType.Identifier)) === null || _a === void 0 ? void 0 : _a.value;
    }
    if (token === null || token === void 0 ? void 0 : token.is(TokenType.IdentifierQuote)) {
        return ((_b = token.getPreviousOfType(TokenType.Identifier)) === null || _b === void 0 ? void 0 : _b.value) || ((_c = token.getNextOfType(TokenType.Identifier)) === null || _c === void 0 ? void 0 : _c.value);
    }
    return;
}
function getTableName(token) {
    const identifier = token === null || token === void 0 ? void 0 : token.getNextOfType(TokenType.Identifier);
    return identifier === null || identifier === void 0 ? void 0 : identifier.value;
}
const getFromKeywordToken = (currentToken) => {
    var _a;
    const selectToken = (_a = currentToken === null || currentToken === void 0 ? void 0 : currentToken.getPreviousOfType(TokenType.Keyword, 'SELECT')) !== null && _a !== void 0 ? _a : null;
    return selectToken === null || selectToken === void 0 ? void 0 : selectToken.getNextOfType(TokenType.Keyword, FROMKEYWORD);
};
const getDatabaseToken = (currentToken) => {
    var _a;
    const fromToken = getFromKeywordToken(currentToken);
    const nextIdentifier = fromToken === null || fromToken === void 0 ? void 0 : fromToken.getNextOfType(TokenType.Identifier);
    if ((nextIdentifier === null || nextIdentifier === void 0 ? void 0 : nextIdentifier.isKeyword()) && ((_a = nextIdentifier.next) === null || _a === void 0 ? void 0 : _a.is(TokenType.Parenthesis, '('))) {
        return null;
    }
    else {
        return nextIdentifier;
    }
};
//# sourceMappingURL=sqlCompletionProvider.js.map