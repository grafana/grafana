import { __awaiter } from "tslib";
import { linkedTokenBuilder } from '../monarch/linkedTokenBuilder';
import { CompletionItemPriority } from '../monarch/types';
import { DYNAMIC_LABEL_PATTERNS } from './language';
export class DynamicLabelsCompletionItemProvider {
    constructor() {
        this.tokenTypes = {
            Parenthesis: 'delimiter.parenthesis.cloudwatch-dynamicLabels',
            Whitespace: 'white.cloudwatch-dynamicLabels',
            Keyword: 'keyword.cloudwatch-dynamicLabels',
            Delimiter: 'delimiter.cloudwatch-dynamicLabels',
            Operator: 'operator.cloudwatch-dynamicLabels',
            Identifier: 'identifier.cloudwatch-dynamicLabels',
            Type: 'type.cloudwatch-dynamicLabels',
            Function: 'predefined.cloudwatch-dynamicLabels',
            Number: 'number.cloudwatch-dynamicLabels',
            String: 'string.cloudwatch-dynamicLabels',
            Variable: 'variable.cloudwatch-dynamicLabels',
            Comment: 'comment.cloudwatch-dynamicLabels',
            Regexp: 'regexp.cloudwatch-dynamicLabels',
        };
    }
    // called by registerLanguage and passed to monaco with registerCompletionItemProvider
    // returns an object that implements https://microsoft.github.io/monaco-editor/api/interfaces/monaco.languages.CompletionItemProvider.html
    getCompletionProvider(monaco, languageDefinition) {
        return {
            triggerCharacters: [' ', '$', ',', '(', "'"],
            provideCompletionItems: (model, position) => __awaiter(this, void 0, void 0, function* () {
                const currentToken = linkedTokenBuilder(monaco, languageDefinition, model, position, this.tokenTypes);
                const invalidRangeToken = (currentToken === null || currentToken === void 0 ? void 0 : currentToken.isWhiteSpace()) || (currentToken === null || currentToken === void 0 ? void 0 : currentToken.isParenthesis());
                const range = invalidRangeToken || !(currentToken === null || currentToken === void 0 ? void 0 : currentToken.range) ? monaco.Range.fromPositions(position) : currentToken === null || currentToken === void 0 ? void 0 : currentToken.range;
                const toCompletionItem = (value, rest = {}) => {
                    const item = Object.assign({ label: value, insertText: value, kind: monaco.languages.CompletionItemKind.Field, range, sortText: CompletionItemPriority.Medium }, rest);
                    return item;
                };
                let suggestions = [];
                const next = currentToken === null || currentToken === void 0 ? void 0 : currentToken.next;
                if (!(currentToken === null || currentToken === void 0 ? void 0 : currentToken.isFunction()) && (!next || next.isWhiteSpace())) {
                    suggestions = DYNAMIC_LABEL_PATTERNS.map((val) => toCompletionItem(val));
                    // always insert suggestion for dimension value and allow user to complete pattern by providing the dimension name
                    suggestions.push(toCompletionItem("${PROP('Dim.')}", {
                        sortText: CompletionItemPriority.High,
                        insertText: `\${PROP('Dim.$0')} `,
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    }));
                }
                return {
                    suggestions,
                };
            }),
        };
    }
}
//# sourceMappingURL=CompletionItemProvider.js.map