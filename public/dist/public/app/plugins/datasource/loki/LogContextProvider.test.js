import { __awaiter } from "tslib";
import { of } from 'rxjs';
import { FieldType, LogRowContextQueryDirection, createDataFrame } from '@grafana/data';
import { LogContextProvider, LOKI_LOG_CONTEXT_PRESERVED_LABELS, SHOULD_INCLUDE_PIPELINE_OPERATIONS, } from './LogContextProvider';
import { createLokiDatasource } from './mocks';
jest.mock('app/core/store', () => {
    return {
        get(item) {
            return window.localStorage.getItem(item);
        },
        getBool(key, defaultValue) {
            const item = window.localStorage.getItem(key);
            if (item === null) {
                return defaultValue;
            }
            else {
                return item === 'true';
            }
        },
    };
});
const defaultLanguageProviderMock = {
    start: jest.fn(),
    fetchSeriesLabels: jest.fn(() => ({ bar: ['baz'], xyz: ['abc'] })),
    getLabelKeys: jest.fn(() => ['bar', 'xyz']),
};
const defaultDatasourceMock = createLokiDatasource();
defaultDatasourceMock.query = jest.fn(() => of({ data: [] }));
defaultDatasourceMock.languageProvider = defaultLanguageProviderMock;
const defaultLogRow = {
    rowIndex: 0,
    dataFrame: createDataFrame({
        fields: [
            {
                name: 'ts',
                type: FieldType.time,
                values: [0],
            },
        ],
    }),
    labels: { bar: 'baz', foo: 'uniqueParsedLabel', xyz: 'abc' },
    uid: '1',
};
describe('LogContextProvider', () => {
    let logContextProvider;
    beforeEach(() => {
        logContextProvider = new LogContextProvider(defaultDatasourceMock);
    });
    afterEach(() => {
        window.localStorage.clear();
    });
    describe('getLogRowContext', () => {
        it('should call getInitContextFilters if no appliedContextFilters', () => __awaiter(void 0, void 0, void 0, function* () {
            logContextProvider.getInitContextFilters = jest
                .fn()
                .mockResolvedValue([{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }]);
            expect(logContextProvider.appliedContextFilters).toHaveLength(0);
            yield logContextProvider.getLogRowContext(defaultLogRow, {
                limit: 10,
                direction: LogRowContextQueryDirection.Backward,
            }, {
                expr: '{bar="baz"}',
                refId: 'A',
            });
            expect(logContextProvider.getInitContextFilters).toBeCalled();
            expect(logContextProvider.getInitContextFilters).toHaveBeenCalledWith({ bar: 'baz', foo: 'uniqueParsedLabel', xyz: 'abc' }, { expr: '{bar="baz"}', refId: 'A' });
            expect(logContextProvider.appliedContextFilters).toHaveLength(1);
        }));
        it('should not call getInitContextFilters if appliedContextFilters', () => __awaiter(void 0, void 0, void 0, function* () {
            logContextProvider.getInitContextFilters = jest
                .fn()
                .mockResolvedValue([{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }]);
            logContextProvider.appliedContextFilters = [
                { value: 'baz', enabled: true, fromParser: false, label: 'bar' },
                { value: 'abc', enabled: true, fromParser: false, label: 'xyz' },
            ];
            yield logContextProvider.getLogRowContext(defaultLogRow, {
                limit: 10,
                direction: LogRowContextQueryDirection.Backward,
            });
            expect(logContextProvider.getInitContextFilters).not.toBeCalled();
            expect(logContextProvider.appliedContextFilters).toHaveLength(2);
        }));
    });
    describe('getLogRowContextQuery', () => {
        it('should call getInitContextFilters if no appliedContextFilters', () => __awaiter(void 0, void 0, void 0, function* () {
            logContextProvider.getInitContextFilters = jest
                .fn()
                .mockResolvedValue([{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }]);
            const query = yield logContextProvider.getLogRowContextQuery(defaultLogRow, {
                limit: 10,
                direction: LogRowContextQueryDirection.Backward,
            });
            expect(query.expr).toBe('{bar="baz"}');
        }));
        it('should not call getInitContextFilters if appliedContextFilters', () => __awaiter(void 0, void 0, void 0, function* () {
            logContextProvider.appliedContextFilters = [
                { value: 'baz', enabled: true, fromParser: false, label: 'bar' },
                { value: 'abc', enabled: true, fromParser: false, label: 'xyz' },
            ];
            const query = yield logContextProvider.getLogRowContextQuery(defaultLogRow, {
                limit: 10,
                direction: LogRowContextQueryDirection.Backward,
            });
            expect(query.expr).toBe('{bar="baz",xyz="abc"}');
        }));
    });
    describe('prepareLogRowContextQueryTarget', () => {
        describe('query with no parser', () => {
            const query = {
                expr: '{bar="baz"}',
                refId: 'A',
            };
            it('returns empty expression if no appliedContextFilters', () => __awaiter(void 0, void 0, void 0, function* () {
                logContextProvider.appliedContextFilters = [];
                const result = yield logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, LogRowContextQueryDirection.Backward, query);
                expect(result.query.expr).toEqual('{}');
            }));
            it('should not apply parsed labels', () => __awaiter(void 0, void 0, void 0, function* () {
                logContextProvider.appliedContextFilters = [
                    { value: 'baz', enabled: true, fromParser: false, label: 'bar' },
                    { value: 'abc', enabled: true, fromParser: false, label: 'xyz' },
                    { value: 'uniqueParsedLabel', enabled: true, fromParser: true, label: 'foo' },
                ];
                const contextQuery = yield logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, LogRowContextQueryDirection.Backward, query);
                expect(contextQuery.query.expr).toEqual('{bar="baz",xyz="abc"}');
            }));
        });
        describe('query with parser', () => {
            it('should apply parser', () => __awaiter(void 0, void 0, void 0, function* () {
                logContextProvider.appliedContextFilters = [
                    { value: 'baz', enabled: true, fromParser: false, label: 'bar' },
                    { value: 'abc', enabled: true, fromParser: false, label: 'xyz' },
                ];
                const contextQuery = yield logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, LogRowContextQueryDirection.Backward, {
                    expr: '{bar="baz"} | logfmt',
                    refId: 'A',
                });
                expect(contextQuery.query.expr).toEqual('{bar="baz",xyz="abc"} | logfmt');
            }));
            it('should apply parser and parsed labels', () => __awaiter(void 0, void 0, void 0, function* () {
                logContextProvider.appliedContextFilters = [
                    { value: 'baz', enabled: true, fromParser: false, label: 'bar' },
                    { value: 'abc', enabled: true, fromParser: false, label: 'xyz' },
                    { value: 'uniqueParsedLabel', enabled: true, fromParser: true, label: 'foo' },
                ];
                const contextQuery = yield logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, LogRowContextQueryDirection.Backward, {
                    expr: '{bar="baz"} | logfmt',
                    refId: 'A',
                });
                expect(contextQuery.query.expr).toEqual('{bar="baz",xyz="abc"} | logfmt | foo=`uniqueParsedLabel`');
            }));
        });
        it('should not apply parser and parsed labels if more parsers in original query', () => __awaiter(void 0, void 0, void 0, function* () {
            logContextProvider.appliedContextFilters = [
                { value: 'baz', enabled: true, fromParser: false, label: 'bar' },
                { value: 'uniqueParsedLabel', enabled: true, fromParser: true, label: 'foo' },
            ];
            const contextQuery = yield logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, LogRowContextQueryDirection.Backward, {
                expr: '{bar="baz"} | logfmt | json',
                refId: 'A',
            });
            expect(contextQuery.query.expr).toEqual(`{bar="baz"}`);
        }));
        it('should not apply line_format if flag is not set by default', () => __awaiter(void 0, void 0, void 0, function* () {
            logContextProvider.appliedContextFilters = [{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }];
            const contextQuery = yield logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, LogRowContextQueryDirection.Backward, {
                expr: '{bar="baz"} | logfmt | line_format "foo"',
                refId: 'A',
            });
            expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt`);
        }));
        it('should not apply line_format if flag is not set', () => __awaiter(void 0, void 0, void 0, function* () {
            window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'false');
            logContextProvider.appliedContextFilters = [{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }];
            const contextQuery = yield logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, LogRowContextQueryDirection.Backward, {
                expr: '{bar="baz"} | logfmt  | line_format "foo"',
                refId: 'A',
            });
            expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt`);
        }));
        it('should apply line_format if flag is set', () => __awaiter(void 0, void 0, void 0, function* () {
            window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
            logContextProvider.appliedContextFilters = [{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }];
            const contextQuery = yield logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, LogRowContextQueryDirection.Backward, {
                expr: '{bar="baz"} | logfmt | line_format "foo"',
                refId: 'A',
            });
            expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format "foo"`);
        }));
        it('should not apply line filters if flag is set', () => __awaiter(void 0, void 0, void 0, function* () {
            window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
            logContextProvider.appliedContextFilters = [{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }];
            let contextQuery = yield logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, LogRowContextQueryDirection.Backward, {
                expr: '{bar="baz"} | logfmt | line_format "foo" |= "bar"',
                refId: 'A',
            });
            expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format "foo"`);
            contextQuery = yield logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, LogRowContextQueryDirection.Backward, {
                expr: '{bar="baz"} | logfmt | line_format "foo" |~ "bar"',
                refId: 'A',
            });
            expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format "foo"`);
            contextQuery = yield logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, LogRowContextQueryDirection.Backward, {
                expr: '{bar="baz"} | logfmt | line_format "foo" !~ "bar"',
                refId: 'A',
            });
            expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format "foo"`);
            contextQuery = yield logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, LogRowContextQueryDirection.Backward, {
                expr: '{bar="baz"} | logfmt | line_format "foo" != "bar"',
                refId: 'A',
            });
            expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format "foo"`);
        }));
        it('should not apply line filters if nested between two operations', () => __awaiter(void 0, void 0, void 0, function* () {
            window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
            logContextProvider.appliedContextFilters = [{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }];
            const contextQuery = yield logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, LogRowContextQueryDirection.Backward, {
                expr: '{bar="baz"} | logfmt | line_format "foo" |= "bar" | label_format a="baz"',
                refId: 'A',
            });
            expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format "foo" | label_format a="baz"`);
        }));
        it('should not apply label filters', () => __awaiter(void 0, void 0, void 0, function* () {
            window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
            logContextProvider.appliedContextFilters = [{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }];
            const contextQuery = yield logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, LogRowContextQueryDirection.Backward, {
                expr: '{bar="baz"} | logfmt | line_format "foo" | bar > 1 | label_format a="baz"',
                refId: 'A',
            });
            expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format "foo" | label_format a="baz"`);
        }));
        it('should not apply additional parsers', () => __awaiter(void 0, void 0, void 0, function* () {
            window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
            logContextProvider.appliedContextFilters = [{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }];
            const contextQuery = yield logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, LogRowContextQueryDirection.Backward, {
                expr: '{bar="baz"} | logfmt | line_format "foo" | json | label_format a="baz"',
                refId: 'A',
            });
            expect(contextQuery.query.expr).toEqual(`{bar="baz"}`);
        }));
    });
    describe('getInitContextFiltersFromLabels', () => {
        describe('query with no parser', () => {
            const queryWithoutParser = {
                expr: '{bar="baz"}',
                refId: 'A',
            };
            it('should correctly create contextFilters', () => __awaiter(void 0, void 0, void 0, function* () {
                const filters = yield logContextProvider.getInitContextFilters(defaultLogRow.labels, queryWithoutParser);
                expect(filters).toEqual([
                    { enabled: true, fromParser: false, label: 'bar', value: 'baz' },
                    { enabled: false, fromParser: true, label: 'foo', value: 'uniqueParsedLabel' },
                    { enabled: true, fromParser: false, label: 'xyz', value: 'abc' },
                ]);
            }));
            it('should return empty contextFilters if no query', () => __awaiter(void 0, void 0, void 0, function* () {
                const filters = yield logContextProvider.getInitContextFilters(defaultLogRow.labels, undefined);
                expect(filters).toEqual([]);
            }));
            it('should return empty contextFilters if no labels', () => __awaiter(void 0, void 0, void 0, function* () {
                const filters = yield logContextProvider.getInitContextFilters({}, queryWithoutParser);
                expect(filters).toEqual([]);
            }));
        });
        describe('query with parser', () => {
            const queryWithParser = {
                expr: '{bar="baz"} | logfmt',
                refId: 'A',
            };
            it('should correctly create contextFilters', () => __awaiter(void 0, void 0, void 0, function* () {
                const filters = yield logContextProvider.getInitContextFilters(defaultLogRow.labels, queryWithParser);
                expect(filters).toEqual([
                    { enabled: true, fromParser: false, label: 'bar', value: 'baz' },
                    { enabled: false, fromParser: true, label: 'foo', value: 'uniqueParsedLabel' },
                    { enabled: true, fromParser: false, label: 'xyz', value: 'abc' },
                ]);
            }));
            it('should return empty contextFilters if no query', () => __awaiter(void 0, void 0, void 0, function* () {
                const filters = yield logContextProvider.getInitContextFilters(defaultLogRow.labels, undefined);
                expect(filters).toEqual([]);
            }));
            it('should return empty contextFilters if no labels', () => __awaiter(void 0, void 0, void 0, function* () {
                const filters = yield logContextProvider.getInitContextFilters({}, queryWithParser);
                expect(filters).toEqual([]);
            }));
        });
        describe('with preserved labels', () => {
            const queryWithParser = {
                expr: '{bar="baz"} | logfmt',
                refId: 'A',
            };
            it('should correctly apply preserved labels', () => __awaiter(void 0, void 0, void 0, function* () {
                window.localStorage.setItem(LOKI_LOG_CONTEXT_PRESERVED_LABELS, JSON.stringify({
                    removedLabels: ['bar'],
                    selectedExtractedLabels: ['foo'],
                }));
                const filters = yield logContextProvider.getInitContextFilters(defaultLogRow.labels, queryWithParser);
                expect(filters).toEqual([
                    { enabled: false, fromParser: false, label: 'bar', value: 'baz' },
                    { enabled: true, fromParser: true, label: 'foo', value: 'uniqueParsedLabel' },
                    { enabled: true, fromParser: false, label: 'xyz', value: 'abc' },
                ]);
            }));
            it('should use contextFilters from row labels if all real labels are disabled', () => __awaiter(void 0, void 0, void 0, function* () {
                window.localStorage.setItem(LOKI_LOG_CONTEXT_PRESERVED_LABELS, JSON.stringify({
                    removedLabels: ['bar', 'xyz'],
                    selectedExtractedLabels: ['foo'],
                }));
                const filters = yield logContextProvider.getInitContextFilters(defaultLogRow.labels, queryWithParser);
                expect(filters).toEqual([
                    { enabled: true, fromParser: false, label: 'bar', value: 'baz' },
                    { enabled: false, fromParser: true, label: 'foo', value: 'uniqueParsedLabel' },
                    { enabled: true, fromParser: false, label: 'xyz', value: 'abc' }, // enabled real label
                ]);
            }));
            it('should not introduce new labels as context filters', () => __awaiter(void 0, void 0, void 0, function* () {
                window.localStorage.setItem(LOKI_LOG_CONTEXT_PRESERVED_LABELS, JSON.stringify({
                    removedLabels: ['bar'],
                    selectedExtractedLabels: ['foo', 'new'],
                }));
                const filters = yield logContextProvider.getInitContextFilters(defaultLogRow.labels, queryWithParser);
                expect(filters).toEqual([
                    { enabled: false, fromParser: false, label: 'bar', value: 'baz' },
                    { enabled: true, fromParser: true, label: 'foo', value: 'uniqueParsedLabel' },
                    { enabled: true, fromParser: false, label: 'xyz', value: 'abc' },
                ]);
            }));
        });
    });
    describe('queryContainsValidPipelineStages', () => {
        it('should return true if query contains a line_format stage', () => {
            expect(logContextProvider.queryContainsValidPipelineStages({ expr: '{foo="bar"} | line_format "foo"', refId: 'A' })).toBe(true);
        });
        it('should return true if query contains a label_format stage', () => {
            expect(logContextProvider.queryContainsValidPipelineStages({ expr: '{foo="bar"} | label_format a="foo"', refId: 'A' })).toBe(true);
        });
        it('should return false if query contains a parser', () => {
            expect(logContextProvider.queryContainsValidPipelineStages({ expr: '{foo="bar"} | json', refId: 'A' })).toBe(false);
        });
        it('should return false if query contains a line filter', () => {
            expect(logContextProvider.queryContainsValidPipelineStages({ expr: '{foo="bar"} |= "test"', refId: 'A' })).toBe(false);
        });
        it('should return true if query contains a line filter and a label_format', () => {
            expect(logContextProvider.queryContainsValidPipelineStages({
                expr: '{foo="bar"} |= "test" | label_format a="foo"',
                refId: 'A',
            })).toBe(true);
        });
    });
});
//# sourceMappingURL=LogContextProvider.test.js.map