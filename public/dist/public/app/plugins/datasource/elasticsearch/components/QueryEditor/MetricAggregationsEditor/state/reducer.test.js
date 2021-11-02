import { __assign } from "tslib";
import { reducerTester } from 'test/core/redux/reducerTester';
import { reducer } from './reducer';
import { addMetric, changeMetricAttribute, changeMetricField, changeMetricMeta, changeMetricSetting, changeMetricType, removeMetric, toggleMetricVisibility, } from './actions';
import { defaultMetricAgg } from '../../../../query_def';
import { metricAggregationConfig } from '../utils';
import { initQuery } from '../../state';
describe('Metric Aggregations Reducer', function () {
    it('should correctly add new aggregations', function () {
        var firstAggregation = {
            id: '1',
            type: 'count',
        };
        var secondAggregation = {
            id: '2',
            type: 'count',
        };
        reducerTester()
            .givenReducer(reducer, [])
            .whenActionIsDispatched(addMetric(firstAggregation.id))
            .thenStateShouldEqual([firstAggregation])
            .whenActionIsDispatched(addMetric(secondAggregation.id))
            .thenStateShouldEqual([firstAggregation, secondAggregation]);
    });
    describe('When removing aggregations', function () {
        it('Should correctly remove aggregations', function () {
            var firstAggregation = {
                id: '1',
                type: 'count',
            };
            var secondAggregation = {
                id: '2',
                type: 'count',
            };
            reducerTester()
                .givenReducer(reducer, [firstAggregation, secondAggregation])
                .whenActionIsDispatched(removeMetric(firstAggregation.id))
                .thenStateShouldEqual([secondAggregation]);
        });
        it('Should insert a default aggregation when the last one is removed', function () {
            var initialState = [{ id: '2', type: 'avg' }];
            reducerTester()
                .givenReducer(reducer, initialState)
                .whenActionIsDispatched(removeMetric(initialState[0].id))
                .thenStateShouldEqual([defaultMetricAgg()]);
        });
    });
    describe("When changing existing aggregation's type", function () {
        it('Should correctly change type to selected aggregation', function () {
            var firstAggregation = {
                id: '1',
                type: 'count',
            };
            var secondAggregation = {
                id: '2',
                type: 'count',
            };
            var expectedSecondAggregation = __assign(__assign({}, secondAggregation), { type: 'avg' });
            reducerTester()
                .givenReducer(reducer, [firstAggregation, secondAggregation])
                .whenActionIsDispatched(changeMetricType({ id: secondAggregation.id, type: expectedSecondAggregation.type }))
                .thenStateShouldEqual([firstAggregation, __assign(__assign({}, secondAggregation), { type: expectedSecondAggregation.type })]);
        });
        it('Should remove all other aggregations when the newly selected one is `isSingleMetric`', function () {
            var firstAggregation = {
                id: '1',
                type: 'count',
            };
            var secondAggregation = {
                id: '2',
                type: 'count',
            };
            var expectedAggregation = __assign(__assign(__assign({}, secondAggregation), { type: 'raw_data' }), metricAggregationConfig['raw_data'].defaults);
            reducerTester()
                .givenReducer(reducer, [firstAggregation, secondAggregation])
                .whenActionIsDispatched(changeMetricType({ id: secondAggregation.id, type: expectedAggregation.type }))
                .thenStateShouldEqual([expectedAggregation]);
        });
    });
    it("Should correctly change aggregation's field", function () {
        var firstAggregation = {
            id: '1',
            type: 'min',
        };
        var secondAggregation = {
            id: '2',
            type: 'moving_fn',
        };
        var expectedSecondAggregation = __assign(__assign({}, secondAggregation), { field: 'new field', pipelineAgg: 'new field' });
        var expectedFirstAggregation = __assign(__assign({}, firstAggregation), { field: 'new field' });
        reducerTester()
            .givenReducer(reducer, [firstAggregation, secondAggregation])
            // When changing a a pipelineAggregation field we set both pipelineAgg and field
            .whenActionIsDispatched(changeMetricField({ id: secondAggregation.id, field: expectedSecondAggregation.field }))
            .thenStateShouldEqual([firstAggregation, expectedSecondAggregation])
            // otherwhise only field
            .whenActionIsDispatched(changeMetricField({ id: firstAggregation.id, field: expectedFirstAggregation.field }))
            .thenStateShouldEqual([expectedFirstAggregation, expectedSecondAggregation]);
    });
    it('Should correctly toggle `hide` field', function () {
        var firstAggregation = {
            id: '1',
            type: 'count',
        };
        var secondAggregation = {
            id: '2',
            type: 'count',
        };
        reducerTester()
            .givenReducer(reducer, [firstAggregation, secondAggregation])
            .whenActionIsDispatched(toggleMetricVisibility(firstAggregation.id))
            .thenStateShouldEqual([__assign(__assign({}, firstAggregation), { hide: true }), secondAggregation])
            .whenActionIsDispatched(toggleMetricVisibility(firstAggregation.id))
            .thenStateShouldEqual([__assign(__assign({}, firstAggregation), { hide: false }), secondAggregation]);
    });
    it("Should correctly change aggregation's settings", function () {
        var firstAggregation = {
            id: '1',
            type: 'derivative',
            settings: {
                unit: 'Some unit',
            },
        };
        var secondAggregation = {
            id: '2',
            type: 'count',
        };
        var expectedSettings = {
            unit: 'Changed unit',
        };
        reducerTester()
            .givenReducer(reducer, [firstAggregation, secondAggregation])
            .whenActionIsDispatched(changeMetricSetting({ metric: firstAggregation, settingName: 'unit', newValue: expectedSettings.unit }))
            .thenStateShouldEqual([__assign(__assign({}, firstAggregation), { settings: expectedSettings }), secondAggregation]);
    });
    it("Should correctly change aggregation's meta", function () {
        var firstAggregation = {
            id: '1',
            type: 'extended_stats',
            meta: {
                avg: true,
            },
        };
        var secondAggregation = {
            id: '2',
            type: 'count',
        };
        var expectedMeta = {
            avg: false,
        };
        reducerTester()
            .givenReducer(reducer, [firstAggregation, secondAggregation])
            .whenActionIsDispatched(changeMetricMeta({ metric: firstAggregation, meta: 'avg', newValue: expectedMeta.avg }))
            .thenStateShouldEqual([__assign(__assign({}, firstAggregation), { meta: expectedMeta }), secondAggregation]);
    });
    it("Should correctly change aggregation's attribute", function () {
        var firstAggregation = {
            id: '1',
            type: 'extended_stats',
        };
        var secondAggregation = {
            id: '2',
            type: 'count',
        };
        var expectedHide = false;
        reducerTester()
            .givenReducer(reducer, [firstAggregation, secondAggregation])
            .whenActionIsDispatched(changeMetricAttribute({ metric: firstAggregation, attribute: 'hide', newValue: expectedHide }))
            .thenStateShouldEqual([__assign(__assign({}, firstAggregation), { hide: expectedHide }), secondAggregation]);
    });
    it('Should not change state with other action types', function () {
        var initialState = [
            {
                id: '1',
                type: 'count',
            },
        ];
        reducerTester()
            .givenReducer(reducer, initialState)
            .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
            .thenStateShouldEqual(initialState);
    });
    it('Should correctly initialize first Metric Aggregation', function () {
        reducerTester()
            .givenReducer(reducer, [])
            .whenActionIsDispatched(initQuery())
            .thenStateShouldEqual([defaultMetricAgg('1')]);
    });
});
//# sourceMappingURL=reducer.test.js.map