import * as queryDef from '../query_def';
describe('ElasticQueryDef', function () {
    describe('getPipelineAggOptions', function () {
        describe('with zero targets', function () {
            var response = queryDef.getPipelineAggOptions([]);
            test('should return zero', function () {
                expect(response.length).toBe(0);
            });
        });
        describe('with count and sum targets', function () {
            var targets = {
                metrics: [{ type: 'count', field: '@value' }, { type: 'sum', field: '@value' }],
            };
            var response = queryDef.getPipelineAggOptions(targets);
            test('should return zero', function () {
                expect(response.length).toBe(2);
            });
        });
        describe('with count and moving average targets', function () {
            var targets = {
                metrics: [{ type: 'count', field: '@value' }, { type: 'moving_avg', field: '@value' }],
            };
            var response = queryDef.getPipelineAggOptions(targets);
            test('should return one', function () {
                expect(response.length).toBe(1);
            });
        });
        describe('with derivatives targets', function () {
            var targets = {
                metrics: [{ type: 'derivative', field: '@value' }],
            };
            var response = queryDef.getPipelineAggOptions(targets);
            test('should return zero', function () {
                expect(response.length).toBe(0);
            });
        });
    });
    describe('isPipelineMetric', function () {
        describe('moving_avg', function () {
            var result = queryDef.isPipelineAgg('moving_avg');
            test('is pipe line metric', function () {
                expect(result).toBe(true);
            });
        });
        describe('count', function () {
            var result = queryDef.isPipelineAgg('count');
            test('is not pipe line metric', function () {
                expect(result).toBe(false);
            });
        });
    });
    describe('isPipelineAggWithMultipleBucketPaths', function () {
        describe('bucket_script', function () {
            var result = queryDef.isPipelineAggWithMultipleBucketPaths('bucket_script');
            test('should have multiple bucket paths support', function () {
                expect(result).toBe(true);
            });
        });
        describe('moving_avg', function () {
            var result = queryDef.isPipelineAggWithMultipleBucketPaths('moving_avg');
            test('should not have multiple bucket paths support', function () {
                expect(result).toBe(false);
            });
        });
    });
    describe('pipeline aggs depending on esverison', function () {
        describe('using esversion undefined', function () {
            test('should not get pipeline aggs', function () {
                expect(queryDef.getMetricAggTypes(undefined).length).toBe(9);
            });
        });
        describe('using esversion 1', function () {
            test('should not get pipeline aggs', function () {
                expect(queryDef.getMetricAggTypes(1).length).toBe(9);
            });
        });
        describe('using esversion 2', function () {
            test('should get pipeline aggs', function () {
                expect(queryDef.getMetricAggTypes(2).length).toBe(12);
            });
        });
        describe('using esversion 5', function () {
            test('should get pipeline aggs', function () {
                expect(queryDef.getMetricAggTypes(5).length).toBe(12);
            });
        });
    });
});
//# sourceMappingURL=query_def.test.js.map