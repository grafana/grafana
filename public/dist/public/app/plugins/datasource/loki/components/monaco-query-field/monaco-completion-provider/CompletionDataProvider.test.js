import { __awaiter } from "tslib";
import LokiLanguageProvider from '../../../LanguageProvider';
import { createLokiDatasource } from '../../../mocks';
import { CompletionDataProvider } from './CompletionDataProvider';
const history = [
    {
        ts: 12345678,
        query: {
            refId: 'test-1',
            expr: '{test: unit}',
        },
    },
    {
        ts: 87654321,
        query: {
            refId: 'test-1',
            expr: '{unit: test}',
        },
    },
    {
        ts: 87654321,
        query: {
            refId: 'test-1',
            expr: '{unit: test}',
        },
    },
    {
        ts: 0,
        query: {
            refId: 'test-0',
            expr: '',
        },
    },
];
const labelKeys = ['place', 'source'];
const labelValues = ['moon', 'luna'];
const otherLabels = [
    {
        name: 'place',
        value: 'luna',
        op: '=',
    },
];
const seriesLabels = { place: ['series', 'labels'], source: [], other: [] };
const parserAndLabelKeys = {
    extractedLabelKeys: ['extracted', 'label', 'keys'],
    unwrapLabelKeys: ['unwrap', 'labels'],
    hasJSON: true,
    hasLogfmt: false,
    hasPack: false,
};
describe('CompletionDataProvider', () => {
    let completionProvider, languageProvider, datasource;
    let historyRef = { current: [] };
    beforeEach(() => {
        datasource = createLokiDatasource();
        languageProvider = new LokiLanguageProvider(datasource);
        historyRef.current = history;
        completionProvider = new CompletionDataProvider(languageProvider, historyRef);
        jest.spyOn(languageProvider, 'getLabelKeys').mockReturnValue(labelKeys);
        jest.spyOn(languageProvider, 'getLabelValues').mockResolvedValue(labelValues);
        jest.spyOn(languageProvider, 'getSeriesLabels').mockResolvedValue(seriesLabels);
        jest.spyOn(languageProvider, 'getParserAndLabelKeys').mockResolvedValue(parserAndLabelKeys);
    });
    test('Returns the expected history entries', () => {
        expect(completionProvider.getHistory()).toEqual(['{test: unit}', '{unit: test}']);
    });
    test('Processes updates to the current historyRef value', () => {
        expect(completionProvider.getHistory()).toEqual(['{test: unit}', '{unit: test}']);
        historyRef.current = [
            {
                ts: 87654321,
                query: {
                    refId: 'test-2',
                    expr: '{value="other"}',
                },
            },
        ];
        expect(completionProvider.getHistory()).toEqual(['{value="other"}']);
    });
    test('Returns the expected label names with no other labels', () => __awaiter(void 0, void 0, void 0, function* () {
        expect(yield completionProvider.getLabelNames([])).toEqual(labelKeys);
    }));
    test('Returns the expected label names with other labels', () => __awaiter(void 0, void 0, void 0, function* () {
        expect(yield completionProvider.getLabelNames(otherLabels)).toEqual(['source', 'other']);
    }));
    test('Returns the expected label values with no other labels', () => __awaiter(void 0, void 0, void 0, function* () {
        expect(yield completionProvider.getLabelValues('label', [])).toEqual(labelValues);
    }));
    test('Returns the expected label values with other labels', () => __awaiter(void 0, void 0, void 0, function* () {
        expect(yield completionProvider.getLabelValues('place', otherLabels)).toEqual(['series', 'labels']);
        expect(yield completionProvider.getLabelValues('other label', otherLabels)).toEqual([]);
    }));
    test('Returns the expected parser and label keys', () => __awaiter(void 0, void 0, void 0, function* () {
        expect(yield completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
        expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledTimes(1);
    }));
    test('Returns the expected parser and label keys, cache duplicate query', () => __awaiter(void 0, void 0, void 0, function* () {
        expect(yield completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
        expect(yield completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
        expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledTimes(1);
    }));
    test('Returns the expected parser and label keys, unique query is not cached', () => __awaiter(void 0, void 0, void 0, function* () {
        //1
        expect(yield completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
        expect(yield completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
        //2
        expect(yield completionProvider.getParserAndLabelKeys('unique')).toEqual(parserAndLabelKeys);
        expect(yield completionProvider.getParserAndLabelKeys('unique')).toEqual(parserAndLabelKeys);
        // 3
        expect(yield completionProvider.getParserAndLabelKeys('uffdah')).toEqual(parserAndLabelKeys);
        // 4
        expect(yield completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
        expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledTimes(4);
    }));
    test('Returns the expected parser and label keys, cache size is 2', () => __awaiter(void 0, void 0, void 0, function* () {
        //1
        expect(yield completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
        expect(yield completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
        //2
        expect(yield completionProvider.getParserAndLabelKeys('unique')).toEqual(parserAndLabelKeys);
        expect(yield completionProvider.getParserAndLabelKeys('unique')).toEqual(parserAndLabelKeys);
        // 2
        expect(yield completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
        expect(yield completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
        expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledTimes(2);
        // 3
        expect(yield completionProvider.getParserAndLabelKeys('new')).toEqual(parserAndLabelKeys);
        expect(yield completionProvider.getParserAndLabelKeys('unique')).toEqual(parserAndLabelKeys);
        expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledTimes(3);
        // 4
        expect(yield completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
        expect(yield completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
        expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledTimes(4);
    }));
    test('Returns the expected series labels', () => __awaiter(void 0, void 0, void 0, function* () {
        expect(yield completionProvider.getSeriesLabels([])).toEqual(seriesLabels);
    }));
});
//# sourceMappingURL=CompletionDataProvider.test.js.map