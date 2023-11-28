import { __awaiter } from "tslib";
import { getTemplateSrv } from '@grafana/runtime';
import { CompletionItemProvider } from '../../monarch/CompletionItemProvider';
import { TRIGGER_SUGGEST } from '../../monarch/commands';
import { SuggestionKind, CompletionItemPriority } from '../../monarch/types';
import { METRIC_MATH_FNS, METRIC_MATH_KEYWORDS, METRIC_MATH_OPERATORS, METRIC_MATH_PERIODS, METRIC_MATH_STATISTIC_KEYWORD_STRINGS, } from '../language';
import { getStatementPosition } from './statementPosition';
import { getSuggestionKinds } from './suggestionKind';
import { MetricMathTokenTypes } from './types';
export class MetricMathCompletionItemProvider extends CompletionItemProvider {
    constructor(resources, templateSrv = getTemplateSrv()) {
        super(resources, templateSrv);
        this.getStatementPosition = getStatementPosition;
        this.getSuggestionKinds = getSuggestionKinds;
        this.tokenTypes = MetricMathTokenTypes;
    }
    getSuggestions(monaco, currentToken, suggestionKinds, statementPosition, position) {
        return __awaiter(this, void 0, void 0, function* () {
            let suggestions = [];
            const invalidRangeToken = (currentToken === null || currentToken === void 0 ? void 0 : currentToken.isWhiteSpace()) || (currentToken === null || currentToken === void 0 ? void 0 : currentToken.isParenthesis());
            const range = invalidRangeToken || !(currentToken === null || currentToken === void 0 ? void 0 : currentToken.range) ? monaco.Range.fromPositions(position) : currentToken === null || currentToken === void 0 ? void 0 : currentToken.range;
            const toCompletionItem = (value, rest = {}) => {
                const item = Object.assign({ label: value, insertText: value, kind: monaco.languages.CompletionItemKind.Field, range, sortText: CompletionItemPriority.Medium }, rest);
                return item;
            };
            function addSuggestion(value, rest = {}) {
                suggestions = [...suggestions, toCompletionItem(value, rest)];
            }
            for (const suggestion of suggestionKinds) {
                switch (suggestion) {
                    case SuggestionKind.FunctionsWithArguments:
                        METRIC_MATH_FNS.map((f) => addSuggestion(f, {
                            insertText: f === 'SEARCH' ? `${f}('$0')` : `${f}($0)`,
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            command: TRIGGER_SUGGEST,
                            kind: monaco.languages.CompletionItemKind.Function,
                        }));
                        break;
                    case SuggestionKind.KeywordArguments:
                        METRIC_MATH_KEYWORDS.map((s) => addSuggestion(s, {
                            insertText: s,
                            command: TRIGGER_SUGGEST,
                            kind: monaco.languages.CompletionItemKind.Keyword,
                            sortText: CompletionItemPriority.MediumHigh,
                        }));
                        break;
                    case SuggestionKind.Statistic:
                        METRIC_MATH_STATISTIC_KEYWORD_STRINGS.map((s) => addSuggestion(s, {
                            insertText: `'${s}', `,
                            command: TRIGGER_SUGGEST,
                        }));
                        break;
                    case SuggestionKind.Operators:
                        METRIC_MATH_OPERATORS.map((s) => addSuggestion(s, {
                            insertText: `${s} `,
                            command: TRIGGER_SUGGEST,
                        }));
                        break;
                    case SuggestionKind.Period:
                        addSuggestion('$__period_auto', {
                            kind: monaco.languages.CompletionItemKind.Variable,
                            sortText: 'a',
                            detail: 'Sets period dynamically to adjust to selected time range.',
                        });
                        METRIC_MATH_PERIODS.map((s, idx) => addSuggestion(s.toString(), {
                            kind: monaco.languages.CompletionItemKind.Value,
                            sortText: String.fromCharCode(97 + idx), // converts index 0, 1 to "a", "b", etc needed to show the time periods in numerical order
                        }));
                        break;
                }
            }
            // always suggest template variables
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
            return suggestions;
        });
    }
}
//# sourceMappingURL=CompletionItemProvider.js.map