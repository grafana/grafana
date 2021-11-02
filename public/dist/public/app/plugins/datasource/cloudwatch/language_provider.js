import { __awaiter, __extends, __generator, __read, __spreadArray, __values } from "tslib";
import { sortedUniq } from 'lodash';
import { lastValueFrom } from 'rxjs';
import Prism from 'prismjs';
import { LanguageProvider } from '@grafana/data';
import { SearchFunctionType } from '@grafana/ui';
import syntax, { AGGREGATION_FUNCTIONS_STATS, BOOLEAN_FUNCTIONS, DATETIME_FUNCTIONS, FIELD_AND_FILTER_FUNCTIONS, IP_FUNCTIONS, NUMERIC_OPERATORS, QUERY_COMMANDS, STRING_FUNCTIONS, } from './syntax';
var CloudWatchLanguageProvider = /** @class */ (function (_super) {
    __extends(CloudWatchLanguageProvider, _super);
    function CloudWatchLanguageProvider(datasource, initialValues) {
        var _this = _super.call(this) || this;
        _this.started = false;
        // Strip syntax chars
        _this.cleanText = function (s) { return s.replace(/[()]/g, '').trim(); };
        _this.request = function (url, params) {
            return lastValueFrom(_this.datasource.awsRequest(url, params));
        };
        _this.start = function () {
            if (!_this.startTask) {
                _this.startTask = Promise.resolve().then(function () {
                    _this.started = true;
                    return [];
                });
            }
            return _this.startTask;
        };
        _this.fetchFields = function (logGroups) { return __awaiter(_this, void 0, void 0, function () {
            var results, fields;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.fetchedFieldsCache &&
                            Date.now() - this.fetchedFieldsCache.time < 30 * 1000 &&
                            sortedUniq(this.fetchedFieldsCache.logGroups).join('|') === sortedUniq(logGroups).join('|')) {
                            return [2 /*return*/, this.fetchedFieldsCache.fields];
                        }
                        return [4 /*yield*/, Promise.all(logGroups.map(function (logGroup) { return _this.datasource.getLogGroupFields({ logGroupName: logGroup }); }))];
                    case 1:
                        results = _a.sent();
                        fields = __spreadArray([], __read(new Set(results.reduce(function (acc, cur) { var _a; return acc.concat((_a = cur.logGroupFields) === null || _a === void 0 ? void 0 : _a.map(function (f) { return f.name; })); }, [])).values()), false);
                        this.fetchedFieldsCache = {
                            time: Date.now(),
                            logGroups: logGroups,
                            fields: fields,
                        };
                        return [2 /*return*/, fields];
                }
            });
        }); };
        _this.handleKeyword = function (context) { return __awaiter(_this, void 0, void 0, function () {
            var suggs, functionSuggestions;
            var _a;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.getFieldCompletionItems((_b = context === null || context === void 0 ? void 0 : context.logGroupNames) !== null && _b !== void 0 ? _b : [])];
                    case 1:
                        suggs = _c.sent();
                        functionSuggestions = [
                            {
                                searchFunctionType: SearchFunctionType.Prefix,
                                label: 'Functions',
                                items: STRING_FUNCTIONS.concat(DATETIME_FUNCTIONS, IP_FUNCTIONS),
                            },
                        ];
                        (_a = suggs.suggestions).push.apply(_a, __spreadArray([], __read(functionSuggestions), false));
                        return [2 /*return*/, suggs];
                }
            });
        }); };
        _this.handleCommand = function (commandToken, curToken, context) { return __awaiter(_this, void 0, void 0, function () {
            var queryCommand, prevToken, currentTokenIsFirstArg, currentTokenIsAfterCommandAndEmpty, currentTokenIsAfterCommand, currentTokenIsComma, currentTokenIsCommaOrAfterComma, typeaheadOutput, typeaheadOutput, sugg, boolFuncs;
            var _a, _b;
            var _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        queryCommand = commandToken.content.toLowerCase();
                        prevToken = prevNonWhitespaceToken(curToken);
                        currentTokenIsFirstArg = prevToken === commandToken;
                        if (queryCommand === 'sort') {
                            return [2 /*return*/, this.handleSortCommand(currentTokenIsFirstArg, curToken, context)];
                        }
                        if (!(queryCommand === 'parse')) return [3 /*break*/, 2];
                        if (!currentTokenIsFirstArg) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getFieldCompletionItems((_c = context === null || context === void 0 ? void 0 : context.logGroupNames) !== null && _c !== void 0 ? _c : [])];
                    case 1: return [2 /*return*/, _g.sent()];
                    case 2:
                        currentTokenIsAfterCommandAndEmpty = isTokenType(commandToken.next, 'whitespace') && !((_d = commandToken.next) === null || _d === void 0 ? void 0 : _d.next);
                        currentTokenIsAfterCommand = currentTokenIsAfterCommandAndEmpty || nextNonWhitespaceToken(commandToken) === curToken;
                        currentTokenIsComma = isTokenType(curToken, 'punctuation', ',');
                        currentTokenIsCommaOrAfterComma = currentTokenIsComma || isTokenType(prevToken, 'punctuation', ',');
                        // We only show suggestions if we are after a command or after a comma which is a field separator
                        if (!(currentTokenIsAfterCommand || currentTokenIsCommaOrAfterComma)) {
                            return [2 /*return*/, { suggestions: [] }];
                        }
                        if (!['display', 'fields'].includes(queryCommand)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.getFieldCompletionItems((_e = context === null || context === void 0 ? void 0 : context.logGroupNames) !== null && _e !== void 0 ? _e : [])];
                    case 3:
                        typeaheadOutput = _g.sent();
                        (_a = typeaheadOutput.suggestions).push.apply(_a, __spreadArray([], __read(this.getFieldAndFilterFunctionCompletionItems().suggestions), false));
                        return [2 /*return*/, typeaheadOutput];
                    case 4:
                        if (queryCommand === 'stats') {
                            typeaheadOutput = this.getStatsAggCompletionItems();
                            if (currentTokenIsComma || currentTokenIsAfterCommandAndEmpty) {
                                typeaheadOutput === null || typeaheadOutput === void 0 ? void 0 : typeaheadOutput.suggestions.forEach(function (group) {
                                    group.skipFilter = true;
                                });
                            }
                            return [2 /*return*/, typeaheadOutput];
                        }
                        if (!(queryCommand === 'filter' && currentTokenIsFirstArg)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.getFieldCompletionItems((_f = context === null || context === void 0 ? void 0 : context.logGroupNames) !== null && _f !== void 0 ? _f : [])];
                    case 5:
                        sugg = _g.sent();
                        boolFuncs = this.getBoolFuncCompletionItems();
                        (_b = sugg.suggestions).push.apply(_b, __spreadArray([], __read(boolFuncs.suggestions), false));
                        return [2 /*return*/, sugg];
                    case 6: return [2 /*return*/, { suggestions: [] }];
                }
            });
        }); };
        _this.handleComparison = function (context) { return __awaiter(_this, void 0, void 0, function () {
            var fieldsSuggestions, comparisonSuggestions;
            var _a;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.getFieldCompletionItems((_b = context === null || context === void 0 ? void 0 : context.logGroupNames) !== null && _b !== void 0 ? _b : [])];
                    case 1:
                        fieldsSuggestions = _c.sent();
                        comparisonSuggestions = this.getComparisonCompletionItems();
                        (_a = fieldsSuggestions.suggestions).push.apply(_a, __spreadArray([], __read(comparisonSuggestions.suggestions), false));
                        return [2 /*return*/, fieldsSuggestions];
                }
            });
        }); };
        _this.getCommandCompletionItems = function () {
            return {
                suggestions: [{ searchFunctionType: SearchFunctionType.Prefix, label: 'Commands', items: QUERY_COMMANDS }],
            };
        };
        _this.getFieldAndFilterFunctionCompletionItems = function () {
            return {
                suggestions: [
                    { searchFunctionType: SearchFunctionType.Prefix, label: 'Functions', items: FIELD_AND_FILTER_FUNCTIONS },
                ],
            };
        };
        _this.getStatsAggCompletionItems = function () {
            return {
                suggestions: [
                    { searchFunctionType: SearchFunctionType.Prefix, label: 'Functions', items: AGGREGATION_FUNCTIONS_STATS },
                ],
            };
        };
        _this.getBoolFuncCompletionItems = function () {
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
        _this.getComparisonCompletionItems = function () {
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
        _this.getFieldCompletionItems = function (logGroups) { return __awaiter(_this, void 0, void 0, function () {
            var fields;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fetchFields(logGroups)];
                    case 1:
                        fields = _a.sent();
                        return [2 /*return*/, {
                                suggestions: [
                                    {
                                        label: 'Fields',
                                        items: fields.map(function (field) { return ({
                                            label: field,
                                            insertText: field.match(/@?[_a-zA-Z]+[_.0-9a-zA-Z]*/) ? undefined : "`" + field + "`",
                                        }); }),
                                    },
                                ],
                            }];
                }
            });
        }); };
        _this.datasource = datasource;
        Object.assign(_this, initialValues);
        return _this;
    }
    CloudWatchLanguageProvider.prototype.getSyntax = function () {
        return syntax;
    };
    CloudWatchLanguageProvider.prototype.isStatsQuery = function (query) {
        var _a;
        var grammar = this.getSyntax();
        var tokens = (_a = Prism.tokenize(query, grammar)) !== null && _a !== void 0 ? _a : [];
        return !!tokens.find(function (token) {
            return typeof token !== 'string' &&
                token.content.toString().toLowerCase() === 'stats' &&
                token.type === 'query-command';
        });
    };
    /**
     * Return suggestions based on input that can be then plugged into a typeahead dropdown.
     * Keep this DOM-free for testing
     * @param input
     * @param context Is optional in types but is required in case we are doing getLabelCompletionItems
     * @param context.absoluteRange Required in case we are doing getLabelCompletionItems
     * @param context.history Optional used only in getEmptyCompletionItems
     */
    CloudWatchLanguageProvider.prototype.provideCompletionItems = function (input, context) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var value, tokens, curToken, isFirstToken, prevToken, isCommandStart, commandToken;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        value = input.value;
                        tokens = value === null || value === void 0 ? void 0 : value.data.get('tokens');
                        if (!tokens || !tokens.length) {
                            return [2 /*return*/, { suggestions: [] }];
                        }
                        curToken = tokens.filter(function (token) { var _a, _b, _c, _d; return token.offsets.start <= ((_b = (_a = value.selection) === null || _a === void 0 ? void 0 : _a.start) === null || _b === void 0 ? void 0 : _b.offset) && token.offsets.end >= ((_d = (_c = value.selection) === null || _c === void 0 ? void 0 : _c.start) === null || _d === void 0 ? void 0 : _d.offset); })[0];
                        isFirstToken = !curToken.prev;
                        prevToken = prevNonWhitespaceToken(curToken);
                        isCommandStart = isFirstToken || (!isFirstToken && (prevToken === null || prevToken === void 0 ? void 0 : prevToken.types.includes('command-separator')));
                        if (isCommandStart) {
                            return [2 /*return*/, this.getCommandCompletionItems()];
                        }
                        if (!isInsideFunctionParenthesis(curToken)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getFieldCompletionItems((_a = context === null || context === void 0 ? void 0 : context.logGroupNames) !== null && _a !== void 0 ? _a : [])];
                    case 1: return [2 /*return*/, _b.sent()];
                    case 2:
                        if (isAfterKeyword('by', curToken)) {
                            return [2 /*return*/, this.handleKeyword(context)];
                        }
                        if (prevToken === null || prevToken === void 0 ? void 0 : prevToken.types.includes('comparison-operator')) {
                            return [2 /*return*/, this.handleComparison(context)];
                        }
                        commandToken = previousCommandToken(curToken);
                        if (!commandToken) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.handleCommand(commandToken, curToken, context)];
                    case 3: return [2 /*return*/, _b.sent()];
                    case 4: return [2 /*return*/, {
                            suggestions: [],
                        }];
                }
            });
        });
    };
    CloudWatchLanguageProvider.prototype.handleSortCommand = function (isFirstArgument, curToken, context) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!isFirstArgument) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getFieldCompletionItems((_a = context === null || context === void 0 ? void 0 : context.logGroupNames) !== null && _a !== void 0 ? _a : [])];
                    case 1: return [2 /*return*/, _b.sent()];
                    case 2:
                        if (isTokenType(prevNonWhitespaceToken(curToken), 'field-name')) {
                            // suggest sort options
                            return [2 /*return*/, {
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
                                }];
                        }
                        _b.label = 3;
                    case 3: return [2 /*return*/, { suggestions: [] }];
                }
            });
        });
    };
    return CloudWatchLanguageProvider;
}(LanguageProvider));
export { CloudWatchLanguageProvider };
function nextNonWhitespaceToken(token) {
    var curToken = token;
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
    var curToken = token;
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
    var thisToken = startToken;
    while (!!thisToken.prev) {
        thisToken = thisToken.prev;
        if (thisToken.types.includes('query-command') &&
            (!thisToken.prev || isTokenType(prevNonWhitespaceToken(thisToken), 'command-separator'))) {
            return thisToken;
        }
    }
    return null;
}
var funcsWithFieldArgs = [
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
].map(function (funcName) { return funcName.toLowerCase(); });
/**
 * Returns true if cursor is currently inside a function parenthesis for example `count(|)` or `count(@mess|)` should
 * return true.
 */
function isInsideFunctionParenthesis(curToken) {
    var prevToken = prevNonWhitespaceToken(curToken);
    if (!prevToken) {
        return false;
    }
    var parenthesisToken = curToken.content === '(' ? curToken : prevToken.content === '(' ? prevToken : undefined;
    if (parenthesisToken) {
        var maybeFunctionToken = prevNonWhitespaceToken(parenthesisToken);
        if (maybeFunctionToken) {
            return (funcsWithFieldArgs.includes(maybeFunctionToken.content.toLowerCase()) &&
                maybeFunctionToken.types.includes('function'));
        }
    }
    return false;
}
function isAfterKeyword(keyword, token) {
    var maybeKeyword = getPreviousTokenExcluding(token, [
        'whitespace',
        'function',
        'punctuation',
        'field-name',
        'number',
    ]);
    if (isTokenType(maybeKeyword, 'keyword', 'by')) {
        var prev = getPreviousTokenExcluding(token, ['whitespace']);
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
    var e_1, _a;
    var curToken = token.prev;
    main: while (curToken) {
        try {
            for (var exclude_1 = (e_1 = void 0, __values(exclude)), exclude_1_1 = exclude_1.next(); !exclude_1_1.done; exclude_1_1 = exclude_1.next()) {
                var item = exclude_1_1.value;
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
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (exclude_1_1 && !exclude_1_1.done && (_a = exclude_1.return)) _a.call(exclude_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        break;
    }
    return curToken;
}
//# sourceMappingURL=language_provider.js.map