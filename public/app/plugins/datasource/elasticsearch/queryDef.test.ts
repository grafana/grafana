import { isPipelineAgg, isPipelineAggWithMultipleBucketPaths } from './queryDef';

describe('ElasticQueryDef', () => {
  describe('isPipelineMetric', () => {
    describe('moving_avg', () => {
      const result = isPipelineAgg('moving_avg');

      test('is pipe line metric', () => {
        expect(result).toBe(true);
      });
    });

    describe('count', () => {
      const result = isPipelineAgg('count');

      test('is not pipe line metric', () => {
        expect(result).toBe(false);
      });
    });
  });

  describe('isPipelineAggWithMultipleBucketPaths', () => {
    describe('bucket_script', () => {
      const result = isPipelineAggWithMultipleBucketPaths('bucket_script');

      test('should have multiple bucket paths support', () => {
        expect(result).toBe(true);
      });
    });

    describe('moving_avg', () => {
      const result = isPipelineAggWithMultipleBucketPaths('moving_avg');

      test('should not have multiple bucket paths support', () => {
        expect(result).toBe(false);
      });
    });
  });
});
