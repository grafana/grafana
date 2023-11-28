import { __awaiter } from "tslib";
import { TemplateSrvStub } from 'test/specs/helpers';
import { dispatch } from 'app/store/store';
import gfunc from '../gfunc';
import { actions } from '../state/actions';
import { getAltSegmentsSelectables, getTagsSelectables, getTagsAsSegmentsSelectables, getTagValuesSelectables, } from '../state/providers';
import { createStore } from '../state/store';
jest.mock('app/angular/promiseToDigest', () => ({
    promiseToDigest: () => {
        return (p) => p;
    },
}));
jest.mock('app/store/store', () => ({
    dispatch: jest.fn(),
}));
const mockDispatch = dispatch;
/**
 * Simulate switching to text editor, changing the query and switching back to visual editor
 */
function changeTarget(ctx, target) {
    return __awaiter(this, void 0, void 0, function* () {
        yield ctx.dispatch(actions.toggleEditorMode());
        yield ctx.dispatch(actions.updateQuery({ query: target }));
        yield ctx.dispatch(actions.runQuery());
        yield ctx.dispatch(actions.toggleEditorMode());
    });
}
describe('Graphite actions', () => {
    const ctx = {
        datasource: {
            metricFindQuery: jest.fn(() => Promise.resolve([])),
            getFuncDefs: jest.fn(() => Promise.resolve(gfunc.getFuncDefs('1.0'))),
            getFuncDef: gfunc.getFuncDef,
            waitForFuncDefsLoaded: jest.fn(() => Promise.resolve(null)),
            createFuncInstance: gfunc.createFuncInstance,
            getTagsAutoComplete: jest.fn().mockReturnValue(Promise.resolve([])),
            getTagValuesAutoComplete: jest.fn().mockReturnValue(Promise.resolve([])),
        },
        target: { target: 'aliasByNode(scaleToSeconds(test.prod.*,1),2)' },
    };
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        jest.clearAllMocks();
        ctx.state = null;
        ctx.dispatch = createStore((state) => {
            ctx.state = state;
        });
        yield ctx.dispatch(actions.init({
            datasource: ctx.datasource,
            target: ctx.target,
            refresh: jest.fn(),
            queries: [],
            //@ts-ignore
            templateSrv: new TemplateSrvStub(),
        }));
    }));
    describe('init', () => {
        it('should validate metric key exists', () => {
            expect(ctx.datasource.metricFindQuery.mock.calls[0][0]).toBe('test.prod.*');
        });
        it('should not delete last segment if no metrics are found', () => {
            expect(ctx.state.segments[2].value).not.toBe('select metric');
            expect(ctx.state.segments[2].value).toBe('*');
        });
        it('should parse expression and build function model', () => {
            expect(ctx.state.queryModel.functions.length).toBe(2);
        });
    });
    describe('when toggling edit mode to raw and back again', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            yield ctx.dispatch(actions.toggleEditorMode());
            yield ctx.dispatch(actions.toggleEditorMode());
        }));
        it('should validate metric key exists', () => {
            const lastCallIndex = ctx.datasource.metricFindQuery.mock.calls.length - 1;
            expect(ctx.datasource.metricFindQuery.mock.calls[lastCallIndex][0]).toBe('test.prod.*');
        });
        it('should parse expression and build function model', () => {
            expect(ctx.state.queryModel.functions.length).toBe(2);
        });
    });
    describe('when middle segment value of test.prod.* is changed', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            const segment = { type: 'metric', value: 'test', expandable: true };
            yield ctx.dispatch(actions.segmentValueChanged({ segment: segment, index: 1 }));
        }));
        it('should validate metric key exists', () => {
            const lastCallIndex = ctx.datasource.metricFindQuery.mock.calls.length - 1;
            expect(ctx.datasource.metricFindQuery.mock.calls[lastCallIndex][0]).toBe('test.test.*');
        });
        it('should parse expression and build function model', () => {
            expect(ctx.state.queryModel.functions.length).toBe(2);
        });
    });
    describe('when adding function', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            ctx.state.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
            yield changeTarget(ctx, 'test.prod.*.count');
            yield ctx.dispatch(actions.addFunction({ name: 'aliasByNode' }));
        }));
        it('should add function with correct node number', () => {
            expect(ctx.state.queryModel.functions[0].params[0]).toBe(2);
        });
        it('should update target', () => {
            expect(ctx.state.target.target).toBe('aliasByNode(test.prod.*.count, 2)');
        });
        it('should call refresh', () => {
            expect(ctx.state.refresh).toHaveBeenCalled();
        });
    });
    describe('when adding function before any metric segment', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            ctx.state.datasource.metricFindQuery = () => Promise.resolve([{ expandable: true }]);
            yield changeTarget(ctx, '');
            yield ctx.dispatch(actions.addFunction({ name: 'asPercent' }));
        }));
        it('should add function and remove select metric link', () => {
            expect(ctx.state.segments.length).toBe(0);
        });
    });
    describe('when initializing a target with single param func using variable', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            ctx.state.datasource.metricFindQuery = () => Promise.resolve([]);
            yield changeTarget(ctx, 'movingAverage(prod.count, $var)');
        }));
        it('should add 2 segments', () => {
            expect(ctx.state.segments.length).toBe(3);
        });
        it('should add function param', () => {
            expect(ctx.state.queryModel.functions[0].params.length).toBe(1);
        });
    });
    describe('when changing the query from the outside', () => {
        it('should update the model', () => __awaiter(void 0, void 0, void 0, function* () {
            ctx.state.datasource.metricFindQuery = () => Promise.resolve([{ text: '*' }]);
            yield changeTarget(ctx, 'my.query.*');
            expect(ctx.state.target.target).toBe('my.query.*');
            expect(ctx.state.segments[0].value).toBe('my');
            expect(ctx.state.segments[1].value).toBe('query');
            yield ctx.dispatch(actions.queryChanged({ target: 'new.metrics.*', refId: 'A' }));
            expect(ctx.state.target.target).toBe('new.metrics.*');
            expect(ctx.state.segments[0].value).toBe('new');
            expect(ctx.state.segments[1].value).toBe('metrics');
        }));
    });
    describe('when initializing target without metric expression and function with series-ref', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            ctx.state.datasource.metricFindQuery = () => Promise.resolve([]);
            yield changeTarget(ctx, 'asPercent(metric.node.count, #A)');
        }));
        it('should add segments', () => {
            expect(ctx.state.segments.length).toBe(4);
        });
        it('should have correct func params', () => {
            expect(ctx.state.queryModel.functions[0].params.length).toBe(1);
        });
    });
    describe('when getting altSegments and metricFindQuery returns empty array', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            ctx.state.datasource.metricFindQuery = () => Promise.resolve([]);
            yield changeTarget(ctx, 'test.count');
            ctx.altSegments = yield getAltSegmentsSelectables(ctx.state, 1, '');
        }));
        it('should have no segments', () => {
            expect(ctx.altSegments.length).toBe(0);
        });
    });
    it('current time range and limit is passed when getting list of tags when editing', () => __awaiter(void 0, void 0, void 0, function* () {
        const currentRange = { from: 0, to: 1 };
        ctx.state.range = currentRange;
        yield getTagsSelectables(ctx.state, 0, 'any');
        expect(ctx.state.datasource.getTagsAutoComplete).toBeCalledWith([], 'any', { range: currentRange, limit: 5000 });
    }));
    it('current time range and limit is passed when getting list of tags for adding', () => __awaiter(void 0, void 0, void 0, function* () {
        const currentRange = { from: 0, to: 1 };
        ctx.state.range = currentRange;
        yield getTagsAsSegmentsSelectables(ctx.state, 'any');
        expect(ctx.state.datasource.getTagsAutoComplete).toBeCalledWith([], 'any', { range: currentRange, limit: 5000 });
    }));
    it('limit is passed when getting list of tag values', () => __awaiter(void 0, void 0, void 0, function* () {
        yield getTagValuesSelectables(ctx.state, { key: 'key', operator: '=', value: 'value' }, 1, 'test');
        expect(ctx.state.datasource.getTagValuesAutoComplete).toBeCalledWith([], 'key', 'test', { limit: 5000 });
    }));
    describe('when autocomplete for metric names is not available', () => {
        beforeEach(() => {
            ctx.state.datasource.getTagsAutoComplete = jest.fn().mockReturnValue(Promise.resolve([]));
            ctx.state.datasource.metricFindQuery = jest.fn().mockReturnValue(new Promise(() => {
                throw new Error();
            }));
        });
        it('getAltSegmentsSelectables should handle autocomplete errors', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(() => __awaiter(void 0, void 0, void 0, function* () {
                yield getAltSegmentsSelectables(ctx.state, 0, 'any');
                expect(mockDispatch).toBeCalledWith(expect.objectContaining({
                    type: 'appNotifications/notifyApp',
                }));
            })).not.toThrow();
        }));
        it('getAltSegmentsSelectables should display the error message only once', () => __awaiter(void 0, void 0, void 0, function* () {
            yield getAltSegmentsSelectables(ctx.state, 0, 'any');
            expect(mockDispatch.mock.calls.length).toBe(1);
            yield getAltSegmentsSelectables(ctx.state, 0, 'any');
            expect(mockDispatch.mock.calls.length).toBe(1);
        }));
    });
    describe('when autocomplete for tags is not available', () => {
        beforeEach(() => {
            ctx.datasource.metricFindQuery = jest.fn().mockReturnValue(Promise.resolve([]));
            ctx.datasource.getTagsAutoComplete = jest.fn().mockReturnValue(new Promise(() => {
                throw new Error();
            }));
        });
        it('getTagsSelectables should handle autocomplete errors', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(() => __awaiter(void 0, void 0, void 0, function* () {
                yield getTagsSelectables(ctx.state, 0, 'any');
                expect(mockDispatch).toBeCalledWith(expect.objectContaining({
                    type: 'appNotifications/notifyApp',
                }));
            })).not.toThrow();
        }));
        it('getTagsSelectables should display the error message only once', () => __awaiter(void 0, void 0, void 0, function* () {
            yield getTagsSelectables(ctx.state, 0, 'any');
            expect(mockDispatch.mock.calls.length).toBe(1);
            yield getTagsSelectables(ctx.state, 0, 'any');
            expect(mockDispatch.mock.calls.length).toBe(1);
        }));
        it('getTagsAsSegmentsSelectables should handle autocomplete errors', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(() => __awaiter(void 0, void 0, void 0, function* () {
                yield getTagsAsSegmentsSelectables(ctx.state, 'any');
                expect(mockDispatch).toBeCalledWith(expect.objectContaining({
                    type: 'appNotifications/notifyApp',
                }));
            })).not.toThrow();
        }));
        it('getTagsAsSegmentsSelectables should display the error message only once', () => __awaiter(void 0, void 0, void 0, function* () {
            yield getTagsAsSegmentsSelectables(ctx.state, 'any');
            expect(mockDispatch.mock.calls.length).toBe(1);
            yield getTagsAsSegmentsSelectables(ctx.state, 'any');
            expect(mockDispatch.mock.calls.length).toBe(1);
        }));
    });
    describe('targetChanged', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            const newQuery = 'aliasByNode(scaleToSeconds(test.prod.*, 1), 2)';
            ctx.state.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
            yield changeTarget(ctx, newQuery);
        }));
        it('should rebuild target after expression model', () => {
            expect(ctx.state.target.target).toBe('aliasByNode(scaleToSeconds(test.prod.*, 1), 2)');
        });
        it('should call refresh', () => {
            expect(ctx.state.refresh).toHaveBeenCalled();
        });
    });
    describe('when updating targets with nested query', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            ctx.state.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
            yield changeTarget(ctx, 'scaleToSeconds(#A, 60)');
        }));
        it('should add function params', () => {
            expect(ctx.state.queryModel.segments.length).toBe(1);
            expect(ctx.state.queryModel.segments[0].value).toBe('#A');
            expect(ctx.state.queryModel.functions[0].params.length).toBe(1);
            expect(ctx.state.queryModel.functions[0].params[0]).toBe(60);
        });
        it('target should remain the same', () => {
            expect(ctx.state.target.target).toBe('scaleToSeconds(#A, 60)');
        });
        it('targetFull should include nested queries', () => __awaiter(void 0, void 0, void 0, function* () {
            yield ctx.dispatch(actions.queriesChanged([
                {
                    target: 'nested.query.count',
                    refId: 'A',
                },
            ]));
            expect(ctx.state.target.target).toBe('scaleToSeconds(#A, 60)');
            expect(ctx.state.target.targetFull).toBe('scaleToSeconds(nested.query.count, 60)');
        }));
    });
    describe('target interpolation', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            ctx.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
            ctx.state.target.refId = 'A';
            yield changeTarget(ctx, 'sumSeries(#B)');
        }));
        it('when updating target used in other query, targetFull of other query should update', () => __awaiter(void 0, void 0, void 0, function* () {
            ctx.state.queries = [ctx.state.target, { target: 'metrics.foo.count', refId: 'B' }];
            yield changeTarget(ctx, 'sumSeries(#B)');
            expect(ctx.state.queryModel.target.targetFull).toBe('sumSeries(metrics.foo.count)');
        }));
        it('when updating target from a query from other data source, targetFull of other query should not update', () => __awaiter(void 0, void 0, void 0, function* () {
            ctx.state.queries = [ctx.state.target, { someOtherProperty: 'metrics.foo.count', refId: 'B' }];
            yield changeTarget(ctx, 'sumSeries(#B)');
            expect(ctx.state.queryModel.target.targetFull).toBeUndefined();
        }));
    });
    describe('when adding seriesByTag function', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            ctx.state.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
            yield changeTarget(ctx, '');
            yield ctx.dispatch(actions.addFunction({ name: 'seriesByTag' }));
        }));
        it('should update functions', () => {
            expect(ctx.state.queryModel.getSeriesByTagFuncIndex()).toBe(0);
        });
        it('should update seriesByTagUsed flag', () => {
            expect(ctx.state.queryModel.seriesByTagUsed).toBe(true);
        });
        it('should update target', () => {
            expect(ctx.state.target.target).toBe('seriesByTag()');
        });
        it('should call refresh', () => {
            expect(ctx.state.refresh).toHaveBeenCalled();
        });
    });
    describe('when parsing seriesByTag function', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            ctx.state.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
            yield changeTarget(ctx, "seriesByTag('tag1=value1', 'tag2!=~value2')");
        }));
        it('should add tags', () => {
            const expected = [
                { key: 'tag1', operator: '=', value: 'value1' },
                { key: 'tag2', operator: '!=~', value: 'value2' },
            ];
            expect(ctx.state.queryModel.tags).toEqual(expected);
        });
    });
    describe('when tag added', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            ctx.state.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
            yield changeTarget(ctx, 'seriesByTag()');
            yield ctx.dispatch(actions.addNewTag({ segment: { value: 'tag1' } }));
        }));
        it('should update tags with default value', () => {
            const expected = [{ key: 'tag1', operator: '=', value: '' }];
            expect(ctx.state.queryModel.tags).toEqual(expected);
        });
        it('should update target', () => {
            const expected = "seriesByTag('tag1=')";
            expect(ctx.state.target.target).toEqual(expected);
        });
    });
    describe('when tag changed', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            ctx.state.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
            yield changeTarget(ctx, "seriesByTag('tag1=value1', 'tag2!=~value2')");
            yield ctx.dispatch(actions.tagChanged({ tag: { key: 'tag1', operator: '=', value: 'new_value' }, index: 0 }));
        }));
        it('should update tags', () => {
            const expected = [
                { key: 'tag1', operator: '=', value: 'new_value' },
                { key: 'tag2', operator: '!=~', value: 'value2' },
            ];
            expect(ctx.state.queryModel.tags).toEqual(expected);
        });
        it('should update target', () => {
            const expected = "seriesByTag('tag1=new_value', 'tag2!=~value2')";
            expect(ctx.state.target.target).toEqual(expected);
        });
    });
    describe('when tag removed', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            ctx.state.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
            yield changeTarget(ctx, "seriesByTag('tag1=value1', 'tag2!=~value2')");
            yield ctx.dispatch(actions.tagChanged({ tag: { key: ctx.state.removeTagValue, operator: '=', value: '' }, index: 0 }));
        }));
        it('should update tags', () => {
            const expected = [{ key: 'tag2', operator: '!=~', value: 'value2' }];
            expect(ctx.state.queryModel.tags).toEqual(expected);
        });
        it('should update target', () => {
            const expected = "seriesByTag('tag2!=~value2')";
            expect(ctx.state.target.target).toEqual(expected);
        });
    });
    describe('when auto-completing over a large set of tags and metrics', () => {
        const manyMetrics = [], max = 20000;
        beforeEach(() => {
            for (let i = 0; i < max; i++) {
                manyMetrics.push({ text: `metric${i}` });
            }
            ctx.state.datasource.metricFindQuery = jest.fn().mockReturnValue(Promise.resolve(manyMetrics));
            ctx.state.datasource.getTagsAutoComplete = jest.fn((_tag, _prefix, { limit }) => {
                const tags = [];
                for (let i = 0; i < limit; i++) {
                    tags.push({ text: `tag${i}` });
                }
                return tags;
            });
        });
        it('uses limited metrics and tags list', () => __awaiter(void 0, void 0, void 0, function* () {
            ctx.state.supportsTags = true;
            const segments = yield getAltSegmentsSelectables(ctx.state, 0, '');
            expect(segments).toHaveLength(10000);
            expect(segments[0].value.value).toBe('*'); // * - is a fixed metric name, always added at the top
            expect(segments[4999].value.value).toBe('metric4998');
            expect(segments[5000].value.value).toBe('tag: tag0');
            expect(segments[9999].value.value).toBe('tag: tag4999');
        }));
        it('uses correct limit for metrics and tags list when tags are not supported', () => __awaiter(void 0, void 0, void 0, function* () {
            ctx.state.supportsTags = false;
            const segments = yield getAltSegmentsSelectables(ctx.state, 0, '');
            expect(segments).toHaveLength(5000);
            expect(segments[0].value.value).toBe('*'); // * - is a fixed metric name, always added at the top
            expect(segments[4999].value.value).toBe('metric4998');
        }));
        it('uses limited metrics when adding more metrics', () => __awaiter(void 0, void 0, void 0, function* () {
            const segments = yield getAltSegmentsSelectables(ctx.state, 1, '');
            expect(segments).toHaveLength(5000);
        }));
    });
});
//# sourceMappingURL=store.test.js.map