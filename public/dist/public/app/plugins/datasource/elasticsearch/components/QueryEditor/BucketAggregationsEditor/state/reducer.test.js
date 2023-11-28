import { reducerTester } from 'test/core/redux/reducerTester';
import { defaultBucketAgg } from 'app/plugins/datasource/elasticsearch/queryDef';
import { changeMetricType } from '../../MetricAggregationsEditor/state/actions';
import { initQuery } from '../../state';
import { bucketAggregationConfig } from '../utils';
import { addBucketAggregation, changeBucketAggregationField, changeBucketAggregationSetting, changeBucketAggregationType, removeBucketAggregation, } from './actions';
import { createReducer } from './reducer';
describe('Bucket Aggregations Reducer', () => {
    it('Should correctly add new aggregations', () => {
        const firstAggregation = {
            id: '1',
            type: 'terms',
            settings: bucketAggregationConfig['terms'].defaultSettings,
        };
        const secondAggregation = {
            id: '1',
            type: 'terms',
            settings: bucketAggregationConfig['terms'].defaultSettings,
        };
        reducerTester()
            .givenReducer(createReducer('@timestamp'), [])
            .whenActionIsDispatched(addBucketAggregation(firstAggregation.id))
            .thenStateShouldEqual([firstAggregation])
            .whenActionIsDispatched(addBucketAggregation(secondAggregation.id))
            .thenStateShouldEqual([firstAggregation, secondAggregation]);
    });
    it('Should correctly remove aggregations', () => {
        const firstAggregation = {
            id: '1',
            type: 'date_histogram',
        };
        const secondAggregation = {
            id: '2',
            type: 'date_histogram',
        };
        reducerTester()
            .givenReducer(createReducer('@timestamp'), [firstAggregation, secondAggregation])
            .whenActionIsDispatched(removeBucketAggregation(firstAggregation.id))
            .thenStateShouldEqual([secondAggregation]);
    });
    it("Should correctly change aggregation's type", () => {
        const firstAggregation = {
            id: '1',
            type: 'date_histogram',
        };
        const secondAggregation = {
            id: '2',
            type: 'date_histogram',
        };
        const expectedSecondAggregation = Object.assign(Object.assign({}, secondAggregation), { type: 'histogram', settings: bucketAggregationConfig['histogram'].defaultSettings });
        reducerTester()
            .givenReducer(createReducer('@timestamp'), [firstAggregation, secondAggregation])
            .whenActionIsDispatched(changeBucketAggregationType({ id: secondAggregation.id, newType: expectedSecondAggregation.type }))
            .thenStateShouldEqual([firstAggregation, expectedSecondAggregation]);
    });
    it("Should correctly change aggregation's field", () => {
        const firstAggregation = {
            id: '1',
            type: 'date_histogram',
        };
        const secondAggregation = {
            id: '2',
            type: 'date_histogram',
        };
        const expectedSecondAggregation = Object.assign(Object.assign({}, secondAggregation), { field: 'new field' });
        reducerTester()
            .givenReducer(createReducer('@timestamp'), [firstAggregation, secondAggregation])
            .whenActionIsDispatched(changeBucketAggregationField({ id: secondAggregation.id, newField: expectedSecondAggregation.field }))
            .thenStateShouldEqual([firstAggregation, expectedSecondAggregation]);
    });
    describe("When changing a metric aggregation's type", () => {
        it('Should remove and restore bucket aggregations correctly', () => {
            const initialState = [
                {
                    id: '1',
                    type: 'date_histogram',
                },
            ];
            reducerTester()
                .givenReducer(createReducer('@timestamp'), initialState)
                // If the new metric aggregation is non-metric, we should remove all bucket aggregations.
                .whenActionIsDispatched(changeMetricType({ id: 'Some id', type: 'raw_data' }))
                .thenStatePredicateShouldEqual((newState) => (newState === null || newState === void 0 ? void 0 : newState.length) === 0)
                // Switching back to another aggregation that is metric should bring back a bucket aggregation
                .whenActionIsDispatched(changeMetricType({ id: 'Some id', type: 'max' }))
                .thenStatePredicateShouldEqual((newState) => (newState === null || newState === void 0 ? void 0 : newState.length) === 1)
                // When none of the above is true state shouldn't change.
                .whenActionIsDispatched(changeMetricType({ id: 'Some id', type: 'min' }))
                .thenStatePredicateShouldEqual((newState) => (newState === null || newState === void 0 ? void 0 : newState.length) === 1);
        });
    });
    it("Should correctly change aggregation's settings", () => {
        const firstAggregation = {
            id: '1',
            type: 'date_histogram',
            settings: {
                min_doc_count: '0',
            },
        };
        const secondAggregation = {
            id: '2',
            type: 'date_histogram',
        };
        const expectedSettings = {
            min_doc_count: '1',
        };
        reducerTester()
            .givenReducer(createReducer('@timestamp'), [firstAggregation, secondAggregation])
            .whenActionIsDispatched(changeBucketAggregationSetting({
            bucketAgg: firstAggregation,
            settingName: 'min_doc_count',
            newValue: expectedSettings.min_doc_count,
        }))
            .thenStateShouldEqual([Object.assign(Object.assign({}, firstAggregation), { settings: expectedSettings }), secondAggregation]);
    });
    describe('Initialization', () => {
        it('Correctly adds a default Date Histogram if there is no aggregation', () => {
            const defaultTimeField = '@timestamp';
            reducerTester()
                .givenReducer(createReducer(defaultTimeField), [])
                .whenActionIsDispatched(initQuery())
                .thenStateShouldEqual([Object.assign(Object.assign({}, defaultBucketAgg('2')), { field: defaultTimeField })]);
        });
        it('Does NOT change aggregations if there is already one', () => {
            const bucketAgg = {
                id: '18',
                type: 'date_histogram',
                field: '@my_time_field',
            };
            reducerTester()
                .givenReducer(createReducer('@timestamp'), [bucketAgg])
                .whenActionIsDispatched(initQuery())
                .thenStateShouldEqual([bucketAgg]);
        });
    });
});
//# sourceMappingURL=reducer.test.js.map