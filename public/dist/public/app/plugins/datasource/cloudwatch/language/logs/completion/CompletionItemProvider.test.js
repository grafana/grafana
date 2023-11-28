import { __awaiter } from "tslib";
import { setupMockedTemplateService, logGroupNamesVariable } from '../../../__mocks__/CloudWatchDataSource';
import { emptyQuery, filterQuery, newCommandQuery, sortQuery } from '../../../__mocks__/cloudwatch-logs-test-data';
import MonacoMock from '../../../__mocks__/monarch/Monaco';
import TextModel from '../../../__mocks__/monarch/TextModel';
import cloudWatchLogsLanguageDefinition from '../definition';
import { LOGS_COMMANDS, LOGS_FUNCTION_OPERATORS, SORT_DIRECTION_KEYWORDS } from '../language';
import { LogsCompletionItemProvider } from './CompletionItemProvider';
jest.mock('monaco-editor/esm/vs/editor/editor.api', () => ({
    Token: jest.fn((offset, type, language) => ({ offset, type, language })),
}));
const getSuggestions = (value, position, variables = []) => __awaiter(void 0, void 0, void 0, function* () {
    const setup = new LogsCompletionItemProvider({
        getActualRegion: () => 'us-east-2',
    }, setupMockedTemplateService(variables));
    const monaco = MonacoMock;
    const provider = setup.getCompletionProvider(monaco, cloudWatchLogsLanguageDefinition);
    const { suggestions } = yield provider.provideCompletionItems(TextModel(value), position);
    return suggestions;
});
describe('LogsCompletionItemProvider', () => {
    describe('getSuggestions', () => {
        it('returns commands for an empty query', () => __awaiter(void 0, void 0, void 0, function* () {
            const suggestions = yield getSuggestions(emptyQuery.query, emptyQuery.position);
            const suggestionLabels = suggestions.map((s) => s.label);
            expect(suggestionLabels).toEqual(expect.arrayContaining(LOGS_COMMANDS));
        }));
        it('returns commands for a query when a new command is started', () => __awaiter(void 0, void 0, void 0, function* () {
            const suggestions = yield getSuggestions(newCommandQuery.query, newCommandQuery.position);
            const suggestionLabels = suggestions.map((s) => s.label);
            expect(suggestionLabels).toEqual(expect.arrayContaining(LOGS_COMMANDS));
        }));
        it('returns sort order directions for the sort keyword', () => __awaiter(void 0, void 0, void 0, function* () {
            const suggestions = yield getSuggestions(sortQuery.query, sortQuery.position);
            const suggestionLabels = suggestions.map((s) => s.label);
            expect(suggestionLabels).toEqual(expect.arrayContaining(SORT_DIRECTION_KEYWORDS));
        }));
        it('returns function suggestions after a command', () => __awaiter(void 0, void 0, void 0, function* () {
            const suggestions = yield getSuggestions(sortQuery.query, sortQuery.position);
            const suggestionLabels = suggestions.map((s) => s.label);
            expect(suggestionLabels).toEqual(expect.arrayContaining(LOGS_FUNCTION_OPERATORS));
        }));
        it('returns `in []` snippet for the `in` keyword', () => __awaiter(void 0, void 0, void 0, function* () {
            const suggestions = yield getSuggestions(filterQuery.query, filterQuery.position);
            const suggestionLabels = suggestions.map((s) => s.label);
            expect(suggestionLabels).toEqual(expect.arrayContaining(['in []']));
        }));
        it('returns template variables appended to list of suggestions', () => __awaiter(void 0, void 0, void 0, function* () {
            const suggestions = yield getSuggestions(newCommandQuery.query, newCommandQuery.position, [
                logGroupNamesVariable,
            ]);
            const suggestionLabels = suggestions.map((s) => s.label);
            const expectedTemplateVariableLabel = `$${logGroupNamesVariable.name}`;
            const expectedLabels = [...LOGS_COMMANDS, expectedTemplateVariableLabel];
            expect(suggestionLabels).toEqual(expect.arrayContaining(expectedLabels));
        }));
    });
});
//# sourceMappingURL=CompletionItemProvider.test.js.map