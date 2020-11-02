import * as queryDef from '../query_def';

describe('ElasticQueryDef', () => {
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
});
