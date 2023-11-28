import { concat } from 'lodash';
import { getAlertManagerSuggestions } from './alertManagerSuggestions';
import { getAlertsSuggestions, getAlertSuggestions, getGlobalSuggestions, getKeyValueSuggestions, getSnippetsSuggestions, } from './templateDataSuggestions';
export function registerGoTemplateAutocomplete(monaco) {
    const goTemplateAutocompleteProvider = {
        triggerCharacters: ['.'],
        provideCompletionItems(model, position, context) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
            };
            const completionProvider = new CompletionProvider(monaco, range);
            const insideExpression = isInsideGoExpression(model, position);
            if (!insideExpression) {
                return completionProvider.getSnippetsSuggestions();
            }
            if (context.triggerKind === monaco.languages.CompletionTriggerKind.Invoke && !context.triggerCharacter) {
                return completionProvider.getFunctionsSuggestions();
            }
            const wordBeforeDot = model.getWordUntilPosition({
                lineNumber: position.lineNumber,
                column: position.column - 1,
            });
            return completionProvider.getTemplateDataSuggestions(wordBeforeDot.word);
        },
    };
    return monaco.languages.registerCompletionItemProvider('go-template', goTemplateAutocompleteProvider);
}
function isInsideGoExpression(model, position) {
    const searchRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: model.getLineMinColumn(position.lineNumber),
        endColumn: model.getLineMaxColumn(position.lineNumber),
    };
    const goSyntaxRegex = '\\{\\{[a-zA-Z0-9._() "]+\\}\\}';
    const matches = model.findMatches(goSyntaxRegex, searchRange, true, false, null, true);
    return matches.some((match) => match.range.containsPosition(position));
}
export class CompletionProvider {
    constructor(monaco, range) {
        this.monaco = monaco;
        this.range = range;
        this.getSnippetsSuggestions = () => {
            return this.getCompletionsFromDefinitions(getSnippetsSuggestions(this.monaco));
        };
        this.getFunctionsSuggestions = () => {
            return this.getCompletionsFromDefinitions(getAlertManagerSuggestions(this.monaco));
        };
        this.getTemplateDataSuggestions = (wordContext) => {
            switch (wordContext) {
                case '':
                    return this.getCompletionsFromDefinitions(getGlobalSuggestions(this.monaco), getAlertSuggestions(this.monaco));
                case 'Alerts':
                    return this.getCompletionsFromDefinitions(getAlertsSuggestions(this.monaco));
                case 'GroupLabels':
                case 'CommonLabels':
                case 'CommonAnnotations':
                case 'Labels':
                case 'Annotations':
                    return this.getCompletionsFromDefinitions(getKeyValueSuggestions(this.monaco));
                default:
                    return { suggestions: [] };
            }
        };
        this.getCompletionsFromDefinitions = (...args) => {
            const allDefinitions = concat(...args);
            return {
                suggestions: allDefinitions.map((definition) => buildAutocompleteSuggestion(definition, this.range)),
            };
        };
    }
}
function buildAutocompleteSuggestion({ label, detail, documentation, kind, insertText }, range) {
    var _a;
    const insertFallback = typeof label === 'string' ? label : label.label;
    const labelObject = typeof label === 'string' ? { label: label, description: detail } : Object.assign({}, label);
    (_a = labelObject.description) !== null && _a !== void 0 ? _a : (labelObject.description = detail);
    return {
        label: labelObject,
        kind: kind,
        insertText: insertText !== null && insertText !== void 0 ? insertText : insertFallback,
        range,
        documentation: documentation,
        detail: detail,
    };
}
//# sourceMappingURL=autocomplete.js.map