import { __awaiter } from "tslib";
import { CompletionItemPriority } from '@grafana/experimental';
import { afterLabelValue, insideLabelValue } from '../../__mocks__/dynamic-label-test-data';
import MonacoMock from '../../__mocks__/monarch/Monaco';
import TextModel from '../../__mocks__/monarch/TextModel';
import { DynamicLabelsCompletionItemProvider } from './CompletionItemProvider';
import cloudWatchDynamicLabelsLanguageDefinition from './definition';
import { DYNAMIC_LABEL_PATTERNS } from './language';
const getSuggestions = (value, position) => __awaiter(void 0, void 0, void 0, function* () {
    const setup = new DynamicLabelsCompletionItemProvider();
    const monaco = MonacoMock;
    const provider = setup.getCompletionProvider(monaco, cloudWatchDynamicLabelsLanguageDefinition);
    const { suggestions } = yield provider.provideCompletionItems(TextModel(value), position);
    return suggestions;
});
describe('Dynamic labels: CompletionItemProvider', () => {
    describe('getSuggestions', () => {
        it('returns all dynamic labels in case current token is a whitespace', () => __awaiter(void 0, void 0, void 0, function* () {
            const { query, position } = afterLabelValue;
            const suggestions = yield getSuggestions(query, position);
            expect(suggestions.length).toEqual(DYNAMIC_LABEL_PATTERNS.length + 1); // + 1 for the dimension suggestions
        }));
        it('should return suggestion for dimension label that has high prio', () => __awaiter(void 0, void 0, void 0, function* () {
            const { query, position } = afterLabelValue;
            const suggestions = yield getSuggestions(query, position);
            expect(suggestions.length).toBeTruthy();
            const highPrioSuggestsions = suggestions.filter((s) => s.sortText === CompletionItemPriority.High);
            expect(highPrioSuggestsions.length).toBe(1);
            expect(highPrioSuggestsions[0].label).toBe("${PROP('Dim.')}");
        }));
        it('doesnt return suggestions if cursor is inside a dynamic label', () => __awaiter(void 0, void 0, void 0, function* () {
            const { query, position } = insideLabelValue;
            const suggestions = yield getSuggestions(query, position);
            expect(suggestions.length).toBe(0);
        }));
    });
});
//# sourceMappingURL=CompletionItemProvider.test.js.map