import { reducerTester } from 'test/core/redux/reducerTester';

import { defaultBucketAgg } from 'app/plugins/datasource/elasticsearch/queryDef';
import { ElasticsearchQuery } from 'app/plugins/datasource/elasticsearch/types';

import { BucketAggregation, DateHistogram } from '../../../../types';
import { changeMetricType } from '../../MetricAggregationsEditor/state/actions';
import { initQuery } from '../../state';
import { bucketAggregationConfig } from '../utils';

import {
  addBucketAggregation,
  changeBucketAggregationField,
  changeBucketAggregationSetting,
  changeBucketAggregationType,
  removeBucketAggregation,
} from './actions';
import { createReducer } from './reducer';

describe('Bucket Aggregations Reducer', () => {
  it('Should correctly add new aggregations', () => {
    const firstAggregation: BucketAggregation = {
      id: '1',
      type: 'terms',
      settings: bucketAggregationConfig['terms'].defaultSettings,
    };

    const secondAggregation: BucketAggregation = {
      id: '1',
      type: 'terms',
      settings: bucketAggregationConfig['terms'].defaultSettings,
    };

    reducerTester<ElasticsearchQuery['bucketAggs']>()
      .givenReducer(createReducer('@timestamp'), [])
      .whenActionIsDispatched(addBucketAggregation(firstAggregation.id))
      .thenStateShouldEqual([firstAggregation])
      .whenActionIsDispatched(addBucketAggregation(secondAggregation.id))
      .thenStateShouldEqual([firstAggregation, secondAggregation]);
  });

  it('Should correctly remove aggregations', () => {
    const firstAggregation: BucketAggregation = {
      id: '1',
      type: 'date_histogram',
    };

    const secondAggregation: BucketAggregation = {
      id: '2',
      type: 'date_histogram',
    };

    reducerTester<ElasticsearchQuery['bucketAggs']>()
      .givenReducer(createReducer('@timestamp'), [firstAggregation, secondAggregation])
      .whenActionIsDispatched(removeBucketAggregation(firstAggregation.id))
      .thenStateShouldEqual([secondAggregation]);
  });

  it("Should correctly change aggregation's type", () => {
    const firstAggregation: BucketAggregation = {
      id: '1',
      type: 'date_histogram',
    };
    const secondAggregation: BucketAggregation = {
      id: '2',
      type: 'date_histogram',
    };

    const expectedSecondAggregation: BucketAggregation = {
      ...secondAggregation,
      type: 'histogram',
      settings: bucketAggregationConfig['histogram'].defaultSettings,
    };

    reducerTester<ElasticsearchQuery['bucketAggs']>()
      .givenReducer(createReducer('@timestamp'), [firstAggregation, secondAggregation])
      .whenActionIsDispatched(
        changeBucketAggregationType({ id: secondAggregation.id, newType: expectedSecondAggregation.type })
      )
      .thenStateShouldEqual([firstAggregation, expectedSecondAggregation]);
  });

  it("Should correctly change aggregation's field", () => {
    const firstAggregation: BucketAggregation = {
      id: '1',
      type: 'date_histogram',
    };
    const secondAggregation: BucketAggregation = {
      id: '2',
      type: 'date_histogram',
    };

    const expectedSecondAggregation = {
      ...secondAggregation,
      field: 'new field',
    };

    reducerTester<ElasticsearchQuery['bucketAggs']>()
      .givenReducer(createReducer('@timestamp'), [firstAggregation, secondAggregation])
      .whenActionIsDispatched(
        changeBucketAggregationField({ id: secondAggregation.id, newField: expectedSecondAggregation.field })
      )
      .thenStateShouldEqual([firstAggregation, expectedSecondAggregation]);
  });

  describe("When changing a metric aggregation's type", () => {
    it('Should remove and restore bucket aggregations correctly', () => {
      const initialState: BucketAggregation[] = [
        {
          id: '1',
          type: 'date_histogram',
        },
      ];

      reducerTester<ElasticsearchQuery['bucketAggs']>()
        .givenReducer(createReducer('@timestamp'), initialState)
        // If the new metric aggregation is non-metric, we should remove all bucket aggregations.
        .whenActionIsDispatched(changeMetricType({ id: 'Some id', type: 'raw_data' }))
        .thenStatePredicateShouldEqual((newState) => newState?.length === 0)
        // Switching back to another aggregation that is metric should bring back a bucket aggregation
        .whenActionIsDispatched(changeMetricType({ id: 'Some id', type: 'max' }))
        .thenStatePredicateShouldEqual((newState) => newState?.length === 1)
        // When none of the above is true state shouldn't change.
        .whenActionIsDispatched(changeMetricType({ id: 'Some id', type: 'min' }))
        .thenStatePredicateShouldEqual((newState) => newState?.length === 1);
    });
  });

  it("Should correctly change aggregation's settings", () => {
    const firstAggregation: DateHistogram = {
      id: '1',
      type: 'date_histogram',
      settings: {
        min_doc_count: '0',
      },
    };
    const secondAggregation: DateHistogram = {
      id: '2',
      type: 'date_histogram',
    };

    const expectedSettings: (typeof firstAggregation)['settings'] = {
      min_doc_count: '1',
    };

    reducerTester<ElasticsearchQuery['bucketAggs']>()
      .givenReducer(createReducer('@timestamp'), [firstAggregation, secondAggregation])
      .whenActionIsDispatched(
        changeBucketAggregationSetting({
          bucketAgg: firstAggregation,
          settingName: 'min_doc_count',
          newValue: expectedSettings.min_doc_count!,
        })
      )
      .thenStateShouldEqual([{ ...firstAggregation, settings: expectedSettings }, secondAggregation]);
  });

  describe('Initialization', () => {
    it('Correctly adds a default Date Histogram if there is no aggregation', () => {
      const defaultTimeField = '@timestamp';

      reducerTester<ElasticsearchQuery['bucketAggs']>()
        .givenReducer(createReducer(defaultTimeField), [])
        .whenActionIsDispatched(initQuery())
        .thenStateShouldEqual([{ ...defaultBucketAgg('2'), field: defaultTimeField }]);
    });

    it('Does NOT change aggregations if there is already one', () => {
      const bucketAgg: DateHistogram = {
        id: '18',
        type: 'date_histogram',
        field: '@my_time_field',
      };

      reducerTester<ElasticsearchQuery['bucketAggs']>()
        .givenReducer(createReducer('@timestamp'), [bucketAgg])
        .whenActionIsDispatched(initQuery())
        .thenStateShouldEqual([bucketAgg]);
    });
  });
});
