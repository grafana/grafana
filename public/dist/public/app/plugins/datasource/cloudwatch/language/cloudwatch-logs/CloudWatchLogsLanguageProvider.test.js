import { __awaiter } from "tslib";
import Prism from 'prismjs';
import { CloudWatchLogsLanguageProvider } from './CloudWatchLogsLanguageProvider';
import { AGGREGATION_FUNCTIONS_STATS, BOOLEAN_FUNCTIONS, DATETIME_FUNCTIONS, IP_FUNCTIONS, NUMERIC_OPERATORS, QUERY_COMMANDS, STRING_FUNCTIONS, FIELD_AND_FILTER_FUNCTIONS, } from './syntax';
const fields = ['field1', '@message'];
describe('CloudWatchLogsLanguageProvider', () => {
    it('should suggest ', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runSuggestionTest('stats count(^)', [fields]);
        // Make sure having a field prefix does not brake anything
        yield runSuggestionTest('stats count(@mess^)', [fields]);
    }));
    it('should suggest query commands on start of query', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runSuggestionTest('^', [QUERY_COMMANDS.map((v) => v.label)]);
    }));
    it('should suggest query commands after pipe', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runSuggestionTest('fields f | ^', [QUERY_COMMANDS.map((v) => v.label)]);
    }));
    it('should suggest fields and functions after field command', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runSuggestionTest('fields ^', [fields, FIELD_AND_FILTER_FUNCTIONS.map((v) => v.label)]);
    }));
    it('should suggest fields and functions after comma', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runSuggestionTest('fields field1, ^', [fields, FIELD_AND_FILTER_FUNCTIONS.map((v) => v.label)]);
    }));
    it('should suggest fields and functions after comma with prefix', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runSuggestionTest('fields field1, @mess^', [fields, FIELD_AND_FILTER_FUNCTIONS.map((v) => v.label)]);
    }));
    it('should suggest fields and functions after display command', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runSuggestionTest('display ^', [fields, FIELD_AND_FILTER_FUNCTIONS.map((v) => v.label)]);
    }));
    it('should suggest functions after stats command', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runSuggestionTest('stats ^', [AGGREGATION_FUNCTIONS_STATS.map((v) => v.label)]);
    }));
    it('should suggest fields and some functions after `by` command', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runSuggestionTest('stats count(something) by ^', [
            fields,
            STRING_FUNCTIONS.concat(DATETIME_FUNCTIONS, IP_FUNCTIONS).map((v) => v.label),
        ]);
    }));
    it('should suggest fields and some functions after comparison operator', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runSuggestionTest('filter field1 >= ^', [
            fields,
            [...NUMERIC_OPERATORS.map((v) => v.label), ...BOOLEAN_FUNCTIONS.map((v) => v.label)],
        ]);
    }));
    it('should suggest fields directly after sort', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runSuggestionTest('sort ^', [fields]);
    }));
    it('should suggest fields directly after sort after a pipe', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runSuggestionTest('fields field1 | sort ^', [fields]);
    }));
    it('should suggest sort order after sort command and field', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runSuggestionTest('sort field1 ^', [['asc', 'desc']]);
    }));
    it('should suggest fields directly after parse', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runSuggestionTest('parse ^', [fields]);
    }));
    it('should suggest fields and bool functions after filter', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runSuggestionTest('filter ^', [fields, BOOLEAN_FUNCTIONS.map((v) => v.label)]);
    }));
    it('should suggest fields and functions after filter bin() function', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runSuggestionTest('stats count(@message) by bin(30m), ^', [
            fields,
            STRING_FUNCTIONS.concat(DATETIME_FUNCTIONS, IP_FUNCTIONS).map((v) => v.label),
        ]);
    }));
    it('should not suggest anything if not after comma in by expression', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runSuggestionTest('stats count(@message) by bin(30m) ^', []);
    }));
});
function runSuggestionTest(query, expectedItems) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield getProvideCompletionItems(query);
        expectedItems.forEach((items, index) => {
            expect(result.suggestions[index].items.map((item) => item.label)).toEqual(items);
        });
    });
}
function makeDatasource() {
    return {
        resources: {
            getLogGroupFields() {
                return Promise.resolve([{ value: { name: 'field1' } }, { value: { name: '@message' } }]);
            },
        },
        /* eslint-disable @typescript-eslint/no-explicit-any */
    };
}
/**
 * Get suggestion items based on query. Use `^` to mark position of the cursor.
 */
function getProvideCompletionItems(query) {
    const provider = new CloudWatchLogsLanguageProvider(makeDatasource());
    const cursorOffset = query.indexOf('^');
    const queryWithoutCursor = query.replace('^', '');
    let tokens = Prism.tokenize(queryWithoutCursor, provider.getSyntax());
    tokens = addTokenMetadata(tokens);
    const value = new ValueMock(tokens, cursorOffset);
    return provider.provideCompletionItems({
        value,
        /* eslint-disable @typescript-eslint/no-explicit-any */
    }, { logGroups: [{ name: 'logGroup1', arn: 'logGroup1' }], region: 'custom' });
}
class ValueMock {
    constructor(tokens, cursorOffset) {
        this.selection = {
            start: {
                offset: cursorOffset,
            },
            /* eslint-disable @typescript-eslint/no-explicit-any */
        };
        this.data = {
            get() {
                return tokens;
            },
            /* eslint-disable @typescript-eslint/no-explicit-any */
        };
    }
}
/**
 * Adds some Slate specific metadata
 * @param tokens
 */
function addTokenMetadata(tokens) {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let prev = undefined;
    let offset = 0;
    return tokens.reduce((acc, token) => {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        let newToken;
        if (typeof token === 'string') {
            newToken = {
                content: token,
                // Not sure what else could it be here, probably if we do not match something
                types: ['whitespace'],
            };
        }
        else {
            newToken = Object.assign({}, token);
            newToken.types = [token.type];
        }
        newToken.prev = prev;
        if (newToken.prev) {
            newToken.prev.next = newToken;
        }
        const end = offset + token.length;
        newToken.offsets = {
            start: offset,
            end,
        };
        prev = newToken;
        offset = end;
        return [...acc, newToken];
    }, []);
}
//# sourceMappingURL=CloudWatchLogsLanguageProvider.test.js.map