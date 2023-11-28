import { __awaiter } from "tslib";
import { getTemplateSrv } from '@grafana/runtime';
import { CompletionItemProvider } from '../../monarch/CompletionItemProvider';
import { TRIGGER_SUGGEST } from '../../monarch/commands';
import { CompletionItemPriority, SuggestionKind } from '../../monarch/types';
import { LOGS_COMMANDS, LOGS_FUNCTION_OPERATORS, SORT_DIRECTION_KEYWORDS } from '../language';
import { getStatementPosition } from './statementPosition';
import { getSuggestionKinds } from './suggestionKinds';
import { LogsTokenTypes } from './types';
export class LogsCompletionItemProvider extends CompletionItemProvider {
    constructor(resources, templateSrv = getTemplateSrv()) {
        super(resources, templateSrv);
        this.getStatementPosition = getStatementPosition;
        this.getSuggestionKinds = getSuggestionKinds;
        this.tokenTypes = LogsTokenTypes;
    }
    getSuggestions(monaco, currentToken, suggestionKinds, statementPosition, position) {
        return __awaiter(this, void 0, void 0, function* () {
            const suggestions = [];
            const invalidRangeToken = (currentToken === null || currentToken === void 0 ? void 0 : currentToken.isWhiteSpace()) || (currentToken === null || currentToken === void 0 ? void 0 : currentToken.isParenthesis());
            const range = invalidRangeToken || !(currentToken === null || currentToken === void 0 ? void 0 : currentToken.range) ? monaco.Range.fromPositions(position) : currentToken === null || currentToken === void 0 ? void 0 : currentToken.range;
            function toCompletionItem(value, rest = {}) {
                const item = Object.assign({ label: value, insertText: value, kind: monaco.languages.CompletionItemKind.Field, range, sortText: CompletionItemPriority.Medium }, rest);
                return item;
            }
            function addSuggestion(value, rest = {}) {
                suggestions.push(toCompletionItem(value, rest));
            }
            for (const kind of suggestionKinds) {
                switch (kind) {
                    case SuggestionKind.Command:
                        LOGS_COMMANDS.forEach((command) => {
                            addSuggestion(command, {
                                insertText: `${command} $0`,
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                command: TRIGGER_SUGGEST,
                            });
                        });
                        break;
                    case SuggestionKind.Function:
                        LOGS_FUNCTION_OPERATORS.forEach((f) => {
                            addSuggestion(f, {
                                insertText: `${f}($0)`,
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                command: TRIGGER_SUGGEST,
                            });
                        });
                        break;
                    case SuggestionKind.SortOrderDirectionKeyword:
                        SORT_DIRECTION_KEYWORDS.forEach((direction) => {
                            addSuggestion(direction, { sortText: CompletionItemPriority.High });
                        });
                        break;
                    case SuggestionKind.InKeyword:
                        addSuggestion('in []', {
                            insertText: 'in ["$0"]',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            sortText: CompletionItemPriority.High,
                        });
                        break;
                }
                this.templateSrv.getVariables().map((v) => {
                    const variable = `$${v.name}`;
                    addSuggestion(variable, {
                        range,
                        label: variable,
                        insertText: variable,
                        kind: monaco.languages.CompletionItemKind.Variable,
                        sortText: CompletionItemPriority.Low,
                    });
                });
            }
            return suggestions;
        });
    }
}
//# sourceMappingURL=CompletionItemProvider.js.map