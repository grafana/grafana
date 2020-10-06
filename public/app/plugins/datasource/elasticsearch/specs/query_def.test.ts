import * as queryDef from '../query_def';

describe('ElasticQueryDef', () => {
  describe('getAncestors', () => {
    describe('with multiple pipeline aggs', () => {
      const maxMetric = { id: '1', type: 'max', field: '@value' };
      const derivativeMetric = { id: '2', type: 'derivative', field: '1' };
      const bucketScriptMetric = {
        id: '3',
        type: 'bucket_script',
        field: '2',
        pipelineVariables: [{ name: 'var1', pipelineAgg: '2' }],
      };
      const target = {
        refId: '1',
        isLogsQuery: false,
        metrics: [maxMetric, derivativeMetric, bucketScriptMetric],
      };
      test('should return id of derivative and bucket_script', () => {
        const response = queryDef.getAncestors(target, derivativeMetric);
        expect(response).toEqual(['2', '3']);
      });
      test('should return id of the bucket_script', () => {
        const response = queryDef.getAncestors(target, bucketScriptMetric);
        expect(response).toEqual(['3']);
      });
      test('should return id of all the metrics', () => {
        const response = queryDef.getAncestors(target, maxMetric);
        expect(response).toEqual(['1', '2', '3']);
      });
    });
  });

  describe('getPipelineAggOptions', () => {
    describe('with zero metrics', () => {
      const target = {
        refId: '1',
        isLogsQuery: false,
        metrics: [],
      };
      const response = queryDef.getPipelineAggOptions(target);

      test('should return zero', () => {
        expect(response.length).toBe(0);
      });
    });

    describe('with count and sum metrics', () => {
      const currentAgg = { type: 'moving_avg', field: '@value', id: '3' };
      const target = {
        refId: '1',
        isLogsQuery: false,
        metrics: [{ type: 'count', field: '@value', id: '1' }, { type: 'sum', field: '@value', id: '2' }, currentAgg],
      };

      const response = queryDef.getPipelineAggOptions(target, currentAgg);

      test('should return zero', () => {
        expect(response.length).toBe(2);
      });
    });

    describe('with count and moving average metrics', () => {
      const currentAgg = { type: 'moving_avg', field: '@value', id: '2' };
      const target = {
        refId: '1',
        isLogsQuery: false,
        metrics: [{ type: 'count', field: '@value', id: '1' }, currentAgg],
      };

      const response = queryDef.getPipelineAggOptions(target, currentAgg);

      test('should return one', () => {
        expect(response.length).toBe(1);
      });
    });

    describe('with multiple chained pipeline aggs', () => {
      const currentAgg = { type: 'moving_avg', field: '2', id: '3' };
      const target = {
        refId: '1',
        isLogsQuery: false,
        metrics: [{ type: 'count', field: '@value', id: '1' }, { type: 'moving_avg', field: '1', id: '2' }, currentAgg],
      };

      const response = queryDef.getPipelineAggOptions(target, currentAgg);

      test('should return two', () => {
        expect(response.length).toBe(2);
      });
    });

    describe('with derivatives metrics', () => {
      const currentAgg = { type: 'derivative', field: '@value', id: '1' };
      const target = {
        refId: '1',
        isLogsQuery: false,
        metrics: [currentAgg],
      };

      const response = queryDef.getPipelineAggOptions(target, currentAgg);

      test('should return zero', () => {
        expect(response.length).toBe(0);
      });
    });
  });

  describe('isPipelineMetric', () => {
    describe('moving_avg', () => {
      const result = queryDef.isPipelineAgg('moving_avg');

      test('is pipe line metric', () => {
        expect(result).toBe(true);
      });
    });

    describe('count', () => {
      const result = queryDef.isPipelineAgg('count');

      test('is not pipe line metric', () => {
        expect(result).toBe(false);
      });
    });
  });

  describe('isPipelineAggWithMultipleBucketPaths', () => {
    describe('bucket_script', () => {
      const result = queryDef.isPipelineAggWithMultipleBucketPaths('bucket_script');

      test('should have multiple bucket paths support', () => {
        expect(result).toBe(true);
      });
    });

    describe('moving_avg', () => {
      const result = queryDef.isPipelineAggWithMultipleBucketPaths('moving_avg');

      test('should not have multiple bucket paths support', () => {
        expect(result).toBe(false);
      });
    });
  });

  describe('pipeline aggs depending on esverison', () => {
    describe('using esversion undefined', () => {
      test('should not get pipeline aggs', () => {
        expect(queryDef.getMetricAggTypes(undefined).length).toBe(11);
      });
    });

    describe('using esversion 1', () => {
      test('should not get pipeline aggs', () => {
        expect(queryDef.getMetricAggTypes(1).length).toBe(11);
      });
    });

    describe('using esversion 2', () => {
      test('should get pipeline aggs', () => {
        expect(queryDef.getMetricAggTypes(2).length).toBe(15);
      });
    });

    describe('using esversion 5', () => {
      test('should get pipeline aggs', () => {
        expect(queryDef.getMetricAggTypes(5).length).toBe(15);
      });
    });
  });
});
