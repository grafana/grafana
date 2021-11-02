import { isPipelineAgg, isPipelineAggWithMultipleBucketPaths } from '../query_def';
describe('ElasticQueryDef', function () {
    describe('isPipelineMetric', function () {
        describe('moving_avg', function () {
            var result = isPipelineAgg('moving_avg');
            test('is pipe line metric', function () {
                expect(result).toBe(true);
            });
        });
        describe('count', function () {
            var result = isPipelineAgg('count');
            test('is not pipe line metric', function () {
                expect(result).toBe(false);
            });
        });
    });
    describe('isPipelineAggWithMultipleBucketPaths', function () {
        describe('bucket_script', function () {
            var result = isPipelineAggWithMultipleBucketPaths('bucket_script');
            test('should have multiple bucket paths support', function () {
                expect(result).toBe(true);
            });
        });
        describe('moving_avg', function () {
            var result = isPipelineAggWithMultipleBucketPaths('moving_avg');
            test('should not have multiple bucket paths support', function () {
                expect(result).toBe(false);
            });
        });
    });
});
//# sourceMappingURL=query_def.test.js.map