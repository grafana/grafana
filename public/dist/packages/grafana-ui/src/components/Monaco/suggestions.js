import { __assign, __values } from "tslib";
import { CodeEditorSuggestionItemKind } from './types';
/**
 * @internal -- only exported for tests
 */
export function findInsertIndex(line) {
    for (var i = line.length - 1; i > 0; i--) {
        var ch = line.charAt(i);
        if (ch === '$') {
            return {
                index: i,
                prefix: line.substring(i),
            };
        }
        // Keep these seperators
        if (ch === ' ' || ch === '\t' || ch === '"' || ch === "'") {
            return {
                index: i + 1,
                prefix: line.substring(i + 1),
            };
        }
    }
    return {
        index: 0,
        prefix: line,
    };
}
function getCompletionItems(monaco, prefix, suggestions, range) {
    var e_1, _a;
    var _b;
    var items = [];
    try {
        for (var suggestions_1 = __values(suggestions), suggestions_1_1 = suggestions_1.next(); !suggestions_1_1.done; suggestions_1_1 = suggestions_1.next()) {
            var suggestion = suggestions_1_1.value;
            if (prefix && !suggestion.label.startsWith(prefix)) {
                continue; // skip non-matching suggestions
            }
            items.push(__assign(__assign({}, suggestion), { kind: mapKinds(monaco, suggestion.kind), range: range, insertText: (_b = suggestion.insertText) !== null && _b !== void 0 ? _b : suggestion.label }));
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (suggestions_1_1 && !suggestions_1_1.done && (_a = suggestions_1.return)) _a.call(suggestions_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return items;
}
function mapKinds(monaco, sug) {
    switch (sug) {
        case CodeEditorSuggestionItemKind.Method:
            return monaco.languages.CompletionItemKind.Method;
        case CodeEditorSuggestionItemKind.Field:
            return monaco.languages.CompletionItemKind.Field;
        case CodeEditorSuggestionItemKind.Property:
            return monaco.languages.CompletionItemKind.Property;
        case CodeEditorSuggestionItemKind.Constant:
            return monaco.languages.CompletionItemKind.Constant;
        case CodeEditorSuggestionItemKind.Text:
            return monaco.languages.CompletionItemKind.Text;
    }
    return monaco.languages.CompletionItemKind.Text;
}
/**
 * @alpha
 */
export function registerSuggestions(monaco, language, getSuggestions) {
    if (!language || !getSuggestions) {
        return undefined;
    }
    return monaco.languages.registerCompletionItemProvider(language, {
        triggerCharacters: ['$'],
        provideCompletionItems: function (model, position, context) {
            var range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column,
                endColumn: position.column,
            };
            // Simple check if this was triggered by pressing `$`
            if (context.triggerCharacter === '$') {
                range.startColumn = position.column - 1;
                return {
                    suggestions: getCompletionItems(monaco, '$', getSuggestions(), range),
                };
            }
            // Find the replacement region
            var currentLine = model.getValueInRange({
                startLineNumber: position.lineNumber,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
            });
            var _a = findInsertIndex(currentLine), index = _a.index, prefix = _a.prefix;
            range.startColumn = index + 1;
            var suggestions = getCompletionItems(monaco, prefix, getSuggestions(), range);
            if (suggestions.length) {
                // NOTE, this will replace any language provided suggestions
                return { suggestions: suggestions };
            }
            // Default language suggestions
            return undefined;
        },
    });
}
//# sourceMappingURL=suggestions.js.map