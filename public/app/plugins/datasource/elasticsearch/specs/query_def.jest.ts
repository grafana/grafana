import * as queryDef from '../query_def';

describe('ElasticQueryDef', () => {
  describe('getPipelineAggOptions', () => {
    describe('with zero targets', () => {
      var response = queryDef.getPipelineAggOptions([]);

      test('should return zero', () => {
        expect(response.length).toBe(0);
      });
    });

    describe('with count and sum targets', () => {
      var targets = {
        metrics: [{ type: 'count', field: '@value' }, { type: 'sum', field: '@value' }],
      };

      var response = queryDef.getPipelineAggOptions(targets);

      test('should return zero', () => {
        expect(response.length).toBe(2);
      });
    });

    describe('with count and moving average targets', () => {
      var targets = {
        metrics: [{ type: 'count', field: '@value' }, { type: 'moving_avg', field: '@value' }],
      };

      var response = queryDef.getPipelineAggOptions(targets);

      test('should return one', () => {
        expect(response.length).toBe(1);
      });
    });

    describe('with derivatives targets', () => {
      var targets = {
        metrics: [{ type: 'derivative', field: '@value' }],
      };

      var response = queryDef.getPipelineAggOptions(targets);

      test('should return zero', () => {
        expect(response.length).toBe(0);
      });
    });
  });

  describe('isPipelineMetric', () => {
    describe('moving_avg', () => {
      var result = queryDef.isPipelineAgg('moving_avg');

      test('is pipe line metric', () => {
        expect(result).toBe(true);
      });
    });

    describe('count', () => {
      var result = queryDef.isPipelineAgg('count');

      test('is not pipe line metric', () => {
        expect(result).toBe(false);
      });
    });
  });

  describe('pipeline aggs depending on esverison', () => {
    describe('using esversion undefined', () => {
      test('should not get pipeline aggs', () => {
        expect(queryDef.getMetricAggTypes(undefined).length).toBe(9);
      });
    });

    describe('using esversion 1', () => {
      test('should not get pipeline aggs', () => {
        expect(queryDef.getMetricAggTypes(1).length).toBe(9);
      });
    });

    describe('using esversion 2', () => {
      test('should get pipeline aggs', () => {
        expect(queryDef.getMetricAggTypes(2).length).toBe(11);
      });
    });

    describe('using esversion 5', () => {
      test('should get pipeline aggs', () => {
        expect(queryDef.getMetricAggTypes(5).length).toBe(11);
      });
    });
  });
});
