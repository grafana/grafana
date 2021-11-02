import { __assign, __awaiter, __generator, __read, __spreadArray } from "tslib";
import { CloudWatchLanguageProvider } from './language_provider';
import Prism from 'prismjs';
import { AGGREGATION_FUNCTIONS_STATS, BOOLEAN_FUNCTIONS, DATETIME_FUNCTIONS, IP_FUNCTIONS, NUMERIC_OPERATORS, QUERY_COMMANDS, STRING_FUNCTIONS, FIELD_AND_FILTER_FUNCTIONS, } from './syntax';
var fields = ['field1', '@message'];
describe('CloudWatchLanguageProvider', function () {
    it('should suggest ', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runSuggestionTest('stats count(\\)', [fields])];
                case 1:
                    _a.sent();
                    // Make sure having a field prefix does not brake anything
                    return [4 /*yield*/, runSuggestionTest('stats count(@mess\\)', [fields])];
                case 2:
                    // Make sure having a field prefix does not brake anything
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should suggest query commands on start of query', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runSuggestionTest('\\', [QUERY_COMMANDS.map(function (v) { return v.label; })])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should suggest query commands after pipe', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runSuggestionTest('fields f | \\', [QUERY_COMMANDS.map(function (v) { return v.label; })])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should suggest fields and functions after field command', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runSuggestionTest('fields \\', [fields, FIELD_AND_FILTER_FUNCTIONS.map(function (v) { return v.label; })])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should suggest fields and functions after comma', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runSuggestionTest('fields field1, \\', [fields, FIELD_AND_FILTER_FUNCTIONS.map(function (v) { return v.label; })])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should suggest fields and functions after comma with prefix', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runSuggestionTest('fields field1, @mess\\', [fields, FIELD_AND_FILTER_FUNCTIONS.map(function (v) { return v.label; })])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should suggest fields and functions after display command', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runSuggestionTest('display \\', [fields, FIELD_AND_FILTER_FUNCTIONS.map(function (v) { return v.label; })])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should suggest functions after stats command', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runSuggestionTest('stats \\', [AGGREGATION_FUNCTIONS_STATS.map(function (v) { return v.label; })])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should suggest fields and some functions after `by` command', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runSuggestionTest('stats count(something) by \\', [
                        fields,
                        STRING_FUNCTIONS.concat(DATETIME_FUNCTIONS, IP_FUNCTIONS).map(function (v) { return v.label; }),
                    ])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should suggest fields and some functions after comparison operator', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runSuggestionTest('filter field1 >= \\', [
                        fields,
                        __spreadArray(__spreadArray([], __read(NUMERIC_OPERATORS.map(function (v) { return v.label; })), false), __read(BOOLEAN_FUNCTIONS.map(function (v) { return v.label; })), false),
                    ])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should suggest fields directly after sort', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runSuggestionTest('sort \\', [fields])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should suggest fields directly after sort after a pipe', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runSuggestionTest('fields field1 | sort \\', [fields])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should suggest sort order after sort command and field', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runSuggestionTest('sort field1 \\', [['asc', 'desc']])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should suggest fields directly after parse', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runSuggestionTest('parse \\', [fields])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should suggest fields and bool functions after filter', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runSuggestionTest('filter \\', [fields, BOOLEAN_FUNCTIONS.map(function (v) { return v.label; })])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should suggest fields and functions after filter bin() function', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runSuggestionTest('stats count(@message) by bin(30m), \\', [
                        fields,
                        STRING_FUNCTIONS.concat(DATETIME_FUNCTIONS, IP_FUNCTIONS).map(function (v) { return v.label; }),
                    ])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should not suggest anything if not after comma in by expression', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runSuggestionTest('stats count(@message) by bin(30m) \\', [])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
function runSuggestionTest(query, expectedItems) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getProvideCompletionItems(query)];
                case 1:
                    result = _a.sent();
                    expectedItems.forEach(function (items, index) {
                        expect(result.suggestions[index].items.map(function (item) { return item.label; })).toEqual(items);
                    });
                    return [2 /*return*/];
            }
        });
    });
}
function makeDatasource() {
    return {
        getLogGroupFields: function () {
            return Promise.resolve({ logGroupFields: [{ name: 'field1' }, { name: '@message' }] });
        },
    };
}
/**
 * Get suggestion items based on query. Use `\\` to mark position of the cursor.
 */
function getProvideCompletionItems(query) {
    var provider = new CloudWatchLanguageProvider(makeDatasource());
    var cursorOffset = query.indexOf('\\');
    var queryWithoutCursor = query.replace('\\', '');
    var tokens = Prism.tokenize(queryWithoutCursor, provider.getSyntax());
    tokens = addTokenMetadata(tokens);
    var value = new ValueMock(tokens, cursorOffset);
    return provider.provideCompletionItems({
        value: value,
    }, { logGroupNames: ['logGroup1'] });
}
var ValueMock = /** @class */ (function () {
    function ValueMock(tokens, cursorOffset) {
        this.selection = {
            start: {
                offset: cursorOffset,
            },
        };
        this.data = {
            get: function () {
                return tokens;
            },
        };
    }
    return ValueMock;
}());
/**
 * Adds some Slate specific metadata
 * @param tokens
 */
function addTokenMetadata(tokens) {
    var prev = undefined;
    var offset = 0;
    return tokens.reduce(function (acc, token) {
        var newToken;
        if (typeof token === 'string') {
            newToken = {
                content: token,
                // Not sure what else could it be here, probably if we do not match something
                types: ['whitespace'],
            };
        }
        else {
            newToken = __assign({}, token);
            newToken.types = [token.type];
        }
        newToken.prev = prev;
        if (newToken.prev) {
            newToken.prev.next = newToken;
        }
        var end = offset + token.length;
        newToken.offsets = {
            start: offset,
            end: end,
        };
        prev = newToken;
        offset = end;
        return __spreadArray(__spreadArray([], __read(acc), false), [newToken], false);
    }, []);
}
//# sourceMappingURL=language_provider.test.js.map