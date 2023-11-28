import { __awaiter } from "tslib";
import { setupMockedTemplateService } from '../../../__mocks__/CloudWatchDataSource';
import * as MetricMathTestData from '../../../__mocks__/metric-math-test-data';
import MonacoMock from '../../../__mocks__/monarch/Monaco';
import TextModel from '../../../__mocks__/monarch/TextModel';
import cloudWatchMetricMathLanguageDefinition from '../definition';
import { METRIC_MATH_FNS, METRIC_MATH_KEYWORDS, METRIC_MATH_OPERATORS, METRIC_MATH_PERIODS, METRIC_MATH_STATISTIC_KEYWORD_STRINGS, } from '../language';
import { MetricMathCompletionItemProvider } from './CompletionItemProvider';
const getSuggestions = (value, position) => __awaiter(void 0, void 0, void 0, function* () {
    const setup = new MetricMathCompletionItemProvider({
        getActualRegion: () => 'us-east-2',
    }, setupMockedTemplateService([]));
    const monaco = MonacoMock;
    const provider = setup.getCompletionProvider(monaco, cloudWatchMetricMathLanguageDefinition);
    const { suggestions } = yield provider.provideCompletionItems(TextModel(value), position);
    return suggestions;
});
describe('MetricMath: CompletionItemProvider', () => {
    describe('getSuggestions', () => {
        it('returns a suggestion for every metric math function when the input field is empty', () => __awaiter(void 0, void 0, void 0, function* () {
            const { query, position } = MetricMathTestData.singleLineEmptyQuery;
            const suggestions = yield getSuggestions(query, position);
            expect(suggestions.length).toEqual(METRIC_MATH_FNS.length);
        }));
        it('returns a suggestion for every metric math operator when at the end of a function', () => __awaiter(void 0, void 0, void 0, function* () {
            const { query, position } = MetricMathTestData.afterFunctionQuery;
            const suggestions = yield getSuggestions(query, position);
            expect(suggestions.length).toEqual(METRIC_MATH_OPERATORS.length);
        }));
        it('returns a suggestion for every metric math function and keyword if at the start of the second argument of a function', () => __awaiter(void 0, void 0, void 0, function* () {
            const { query, position } = MetricMathTestData.secondArgQuery;
            const suggestions = yield getSuggestions(query, position);
            expect(suggestions.length).toEqual(METRIC_MATH_FNS.length + METRIC_MATH_KEYWORDS.length);
        }));
        it('does not have any particular suggestions if within a string', () => __awaiter(void 0, void 0, void 0, function* () {
            const { query, position } = MetricMathTestData.withinStringQuery;
            const suggestions = yield getSuggestions(query, position);
            expect(suggestions.length).toEqual(0);
        }));
        it('returns a suggestion for every statistic if the second arg of a search function', () => __awaiter(void 0, void 0, void 0, function* () {
            const { query, position } = MetricMathTestData.secondArgAfterSearchQuery;
            const suggestions = yield getSuggestions(query, position);
            expect(suggestions.length).toEqual(METRIC_MATH_STATISTIC_KEYWORD_STRINGS.length);
        }));
        it('returns a suggestion for every period if the third arg of a search function', () => __awaiter(void 0, void 0, void 0, function* () {
            const { query, position } = MetricMathTestData.thirdArgAfterSearchQuery;
            const suggestions = yield getSuggestions(query, position);
            // +1 because one suggestion is also added for the  $__period_auto macro
            const expectedSuggestionsLength = METRIC_MATH_PERIODS.length + 1;
            expect(suggestions.length).toEqual(expectedSuggestionsLength);
        }));
    });
});
//# sourceMappingURL=CompletionItemProvider.test.js.map