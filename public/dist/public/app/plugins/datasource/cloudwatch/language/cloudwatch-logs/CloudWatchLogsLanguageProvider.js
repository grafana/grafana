import { __awaiter } from "tslib";
import Prism from 'prismjs';
import { lastValueFrom } from 'rxjs';
import { LanguageProvider } from '@grafana/data';
import { SearchFunctionType } from '@grafana/ui';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import { interpolateStringArrayUsingSingleOrMultiValuedVariable } from '../../utils/templateVariableUtils';
import syntax, { AGGREGATION_FUNCTIONS_STATS, BOOLEAN_FUNCTIONS, DATETIME_FUNCTIONS, FIELD_AND_FILTER_FUNCTIONS, IP_FUNCTIONS, NUMERIC_OPERATORS, QUERY_COMMANDS, STRING_FUNCTIONS, } from './syntax';
export class CloudWatchLogsLanguageProvider extends LanguageProvider {
    constructor(datasource, initialValues) {
        super();
        this.started = false;
        // Strip syntax chars
        this.cleanText = (s) => s.replace(/[()]/g, '').trim();
        this.request = (url, params) => {
            return lastValueFrom(this.datasource.logsQueryRunner.awsRequest(url, params));
        };
        this.start = () => {
            if (!this.startTask) {
                this.startTask = Promise.resolve().then(() => {
                    this.started = true;
                    return [];
                });
            }
            return this.startTask;
        };
        this.fetchFields = (logGroups, region) => __awaiter(this, void 0, void 0, function* () {
            const interpolatedLogGroups = interpolateStringArrayUsingSingleOrMultiValuedVariable(getTemplateSrv(), logGroups.map((lg) => lg.name), {}, 'text');
            const results = yield Promise.all(interpolatedLogGroups.map((logGroupName) => this.datasource.resources
                .getLogGroupFields({ logGroupName, region })
                .then((fields) => fields.filter((f) => f).map((f) => { var _a; return (_a = f.value.name) !== null && _a !== void 0 ? _a : ''; }))));
            return results.flat();
        });
        this.handleKeyword = (context) => __awaiter(this, void 0, void 0, function* () {
            const suggs = yield this.getFieldCompletionItems(context === null || context === void 0 ? void 0 : context.logGroups, (context === null || context === void 0 ? void 0 : context.region) || 'default');
            const functionSuggestions = [
                {
                    searchFunctionType: SearchFunctionType.Prefix,
                    label: 'Functions',
                    items: STRING_FUNCTIONS.concat(DATETIME_FUNCTIONS, IP_FUNCTIONS),
                },
            ];
            suggs.suggestions.push(...functionSuggestions);
            return suggs;
        });
        this.handleCommand = (commandToken, curToken, context) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const queryCommand = commandToken.content.toLowerCase();
            const prevToken = prevNonWhitespaceToken(curToken);
            const currentTokenIsFirstArg = prevToken === commandToken;
            if (queryCommand === 'sort') {
                return this.handleSortCommand(currentTokenIsFirstArg, curToken, context);
            }
            if (queryCommand === 'parse') {
                if (currentTokenIsFirstArg) {
                    return yield this.getFieldCompletionItems((_a = context === null || context === void 0 ? void 0 : context.logGroups) !== null && _a !== void 0 ? _a : [], (context === null || context === void 0 ? void 0 : context.region) || 'default');
                }
            }
            const currentTokenIsAfterCommandAndEmpty = isTokenType(commandToken.next, 'whitespace') && !((_b = commandToken.next) === null || _b === void 0 ? void 0 : _b.next);
            const currentTokenIsAfterCommand = currentTokenIsAfterCommandAndEmpty || nextNonWhitespaceToken(commandToken) === curToken;
            const currentTokenIsComma = isTokenType(curToken, 'punctuation', ',');
            const currentTokenIsCommaOrAfterComma = currentTokenIsComma || isTokenType(prevToken, 'punctuation', ',');
            // We only show suggestions if we are after a command or after a comma which is a field separator
            if (!(currentTokenIsAfterCommand || currentTokenIsCommaOrAfterComma)) {
                return { suggestions: [] };
            }
            if (['display', 'fields'].includes(queryCommand)) {
                const typeaheadOutput = yield this.getFieldCompletionItems((_c = context === null || context === void 0 ? void 0 : context.logGroups) !== null && _c !== void 0 ? _c : [], (context === null || context === void 0 ? void 0 : context.region) || 'default');
                typeaheadOutput.suggestions.push(...this.getFieldAndFilterFunctionCompletionItems().suggestions);
                return typeaheadOutput;
            }
            if (queryCommand === 'stats') {
                const typeaheadOutput = this.getStatsAggCompletionItems();
                if (currentTokenIsComma || currentTokenIsAfterCommandAndEmpty) {
                    typeaheadOutput === null || typeaheadOutput === void 0 ? void 0 : typeaheadOutput.suggestions.forEach((group) => {
                        group.skipFilter = true;
                    });
                }
                return typeaheadOutput;
            }
            if (queryCommand === 'filter' && currentTokenIsFirstArg) {
                const sugg = yield this.getFieldCompletionItems(context === null || context === void 0 ? void 0 : context.logGroups, (context === null || context === void 0 ? void 0 : context.region) || 'default');
                const boolFuncs = this.getBoolFuncCompletionItems();
                sugg.suggestions.push(...boolFuncs.suggestions);
                return sugg;
            }
            return { suggestions: [] };
        });
        this.handleComparison = (context) => __awaiter(this, void 0, void 0, function* () {
            const fieldsSuggestions = yield this.getFieldCompletionItems(context === null || context === void 0 ? void 0 : context.logGroups, (context === null || context === void 0 ? void 0 : context.region) || 'default');
            const comparisonSuggestions = this.getComparisonCompletionItems();
            fieldsSuggestions.suggestions.push(...comparisonSuggestions.suggestions);
            return fieldsSuggestions;
        });
        this.getCommandCompletionItems = () => {
            return {
                suggestions: [{ searchFunctionType: SearchFunctionType.Prefix, label: 'Commands', items: QUERY_COMMANDS }],
            };
        };
        this.getFieldAndFilterFunctionCompletionItems = () => {
            return {
                suggestions: [
                    { searchFunctionType: SearchFunctionType.Prefix, label: 'Functions', items: FIELD_AND_FILTER_FUNCTIONS },
                ],
            };
        };
        this.getStatsAggCompletionItems = () => {
            return {
                suggestions: [
                    { searchFunctionType: SearchFunctionType.Prefix, label: 'Functions', items: AGGREGATION_FUNCTIONS_STATS },
                ],
            };
        };
        this.getBoolFuncCompletionItems = () => {
            return {
                suggestions: [
                    {
                        searchFunctionType: SearchFunctionType.Prefix,
                        label: 'Functions',
                        items: BOOLEAN_FUNCTIONS,
                    },
                ],
            };
        };
        this.getComparisonCompletionItems = () => {
            return {
                suggestions: [
                    {
                        searchFunctionType: SearchFunctionType.Prefix,
                        label: 'Functions',
                        items: NUMERIC_OPERATORS.concat(BOOLEAN_FUNCTIONS),
                    },
                ],
            };
        };
        this.getFieldCompletionItems = (logGroups, region) => __awaiter(this, void 0, void 0, function* () {
            if (!logGroups) {
                return { suggestions: [] };
            }
            const fields = yield this.fetchFields(logGroups, region);
            return {
                suggestions: [
                    {
                        label: 'Fields',
                        items: fields.map((field) => ({
                            label: field,
                            insertText: field.match(/@?[_a-zA-Z]+[_.0-9a-zA-Z]*/) ? undefined : `\`${field}\``,
                        })),
                    },
                ],
            };
        });
        this.datasource = datasource;
        Object.assign(this, initialValues);
    }
    getSyntax() {
        return syntax;
    }
    isStatsQuery(query) {
        var _a;
        const grammar = this.getSyntax();
        const tokens = (_a = Prism.tokenize(query, grammar)) !== null && _a !== void 0 ? _a : [];
        return !!tokens.find((token) => typeof token !== 'string' &&
            token.content.toString().toLowerCase() === 'stats' &&
            token.type === 'query-command');
    }
    /**
     * Return suggestions based on input that can be then plugged into a typeahead dropdown.
     * Keep this DOM-free for testing
     * @param input
     * @param context Is optional in types but is required in case we are doing getLabelCompletionItems
     * @param context.absoluteRange Required in case we are doing getLabelCompletionItems
     * @param context.history Optional used only in getEmptyCompletionItems
     */
    provideCompletionItems(input, context) {
        return __awaiter(this, void 0, void 0, function* () {
            const { value } = input;
            // Get tokens
            const tokens = value === null || value === void 0 ? void 0 : value.data.get('tokens');
            if (!tokens || !tokens.length) {
                return { suggestions: [] };
            }
            const curToken = tokens.filter((token) => { var _a, _b, _c, _d; return token.offsets.start <= ((_b = (_a = value.selection) === null || _a === void 0 ? void 0 : _a.start) === null || _b === void 0 ? void 0 : _b.offset) && token.offsets.end >= ((_d = (_c = value.selection) === null || _c === void 0 ? void 0 : _c.start) === null || _d === void 0 ? void 0 : _d.offset); })[0];
            const isFirstToken = !curToken.prev;
            const prevToken = prevNonWhitespaceToken(curToken);
            const isCommandStart = isFirstToken || (!isFirstToken && (prevToken === null || prevToken === void 0 ? void 0 : prevToken.types.includes('command-separator')));
            if (isCommandStart) {
                return this.getCommandCompletionItems();
            }
            if (isInsideFunctionParenthesis(curToken)) {
                return yield this.getFieldCompletionItems(context === null || context === void 0 ? void 0 : context.logGroups, (context === null || context === void 0 ? void 0 : context.region) || 'default');
            }
            if (isAfterKeyword('by', curToken)) {
                return this.handleKeyword(context);
            }
            if (prevToken === null || prevToken === void 0 ? void 0 : prevToken.types.includes('comparison-operator')) {
                return this.handleComparison(context);
            }
            const commandToken = previousCommandToken(curToken);
            if (commandToken) {
                return yield this.handleCommand(commandToken, curToken, context);
            }
            return {
                suggestions: [],
            };
        });
    }
    handleSortCommand(isFirstArgument, curToken, context) {
        return __awaiter(this, void 0, void 0, function* () {
            if (isFirstArgument) {
                return yield this.getFieldCompletionItems(context === null || context === void 0 ? void 0 : context.logGroups, (context === null || context === void 0 ? void 0 : context.region) || 'default');
            }
            else if (isTokenType(prevNonWhitespaceToken(curToken), 'field-name')) {
                // suggest sort options
                return {
                    suggestions: [
                        {
                            searchFunctionType: SearchFunctionType.Prefix,
                            label: 'Sort Order',
                            items: [
                                {
                                    label: 'asc',
                                },
                                { label: 'desc' },
                            ],
                        },
                    ],
                };
            }
            return { suggestions: [] };
        });
    }
}
function nextNonWhitespaceToken(token) {
    let curToken = token;
    while (curToken.next) {
        if (curToken.next.types.includes('whitespace')) {
            curToken = curToken.next;
        }
        else {
            return curToken.next;
        }
    }
    return null;
}
function prevNonWhitespaceToken(token) {
    let curToken = token;
    while (curToken.prev) {
        if (isTokenType(curToken.prev, 'whitespace')) {
            curToken = curToken.prev;
        }
        else {
            return curToken.prev;
        }
    }
    return null;
}
function previousCommandToken(startToken) {
    let thisToken = startToken;
    while (!!thisToken.prev) {
        thisToken = thisToken.prev;
        if (thisToken.types.includes('query-command') &&
            (!thisToken.prev || isTokenType(prevNonWhitespaceToken(thisToken), 'command-separator'))) {
            return thisToken;
        }
    }
    return null;
}
const funcsWithFieldArgs = [
    'avg',
    'count',
    'count_distinct',
    'earliest',
    'latest',
    'sortsFirst',
    'sortsLast',
    'max',
    'min',
    'pct',
    'stddev',
    'ispresent',
    'fromMillis',
    'toMillis',
    'isempty',
    'isblank',
    'isValidIp',
    'isValidIpV4',
    'isValidIpV6',
    'isIpInSubnet',
    'isIpv4InSubnet',
    'isIpv6InSubnet',
].map((funcName) => funcName.toLowerCase());
/**
 * Returns true if cursor is currently inside a function parenthesis for example `count(|)` or `count(@mess|)` should
 * return true.
 */
function isInsideFunctionParenthesis(curToken) {
    const prevToken = prevNonWhitespaceToken(curToken);
    if (!prevToken) {
        return false;
    }
    const parenthesisToken = curToken.content === '(' ? curToken : prevToken.content === '(' ? prevToken : undefined;
    if (parenthesisToken) {
        const maybeFunctionToken = prevNonWhitespaceToken(parenthesisToken);
        if (maybeFunctionToken) {
            return (funcsWithFieldArgs.includes(maybeFunctionToken.content.toLowerCase()) &&
                maybeFunctionToken.types.includes('function'));
        }
    }
    return false;
}
function isAfterKeyword(keyword, token) {
    const maybeKeyword = getPreviousTokenExcluding(token, [
        'whitespace',
        'function',
        'punctuation',
        'field-name',
        'number',
    ]);
    if (isTokenType(maybeKeyword, 'keyword', 'by')) {
        const prev = getPreviousTokenExcluding(token, ['whitespace']);
        if (prev === maybeKeyword || isTokenType(prev, 'punctuation', ',')) {
            return true;
        }
    }
    return false;
}
function isTokenType(token, type, content) {
    if (!(token === null || token === void 0 ? void 0 : token.types.includes(type))) {
        return false;
    }
    if (content) {
        if ((token === null || token === void 0 ? void 0 : token.content.toLowerCase()) !== content) {
            return false;
        }
    }
    return true;
}
function getPreviousTokenExcluding(token, exclude) {
    let curToken = token.prev;
    main: while (curToken) {
        for (const item of exclude) {
            if (typeof item === 'string') {
                if (curToken.types.includes(item)) {
                    curToken = curToken.prev;
                    continue main;
                }
            }
            else {
                if (curToken.types.includes(item.type) && curToken.content.toLowerCase() === item.value) {
                    curToken = curToken.prev;
                    continue main;
                }
            }
        }
        break;
    }
    return curToken;
}
//# sourceMappingURL=CloudWatchLogsLanguageProvider.js.map