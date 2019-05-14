import { ResultTransformer } from '../result_transformer';
describe('Prometheus Result Transformer', function () {
    var ctx = {};
    beforeEach(function () {
        ctx.templateSrv = {
            replace: function (str) { return str; },
        };
        ctx.resultTransformer = new ResultTransformer(ctx.templateSrv);
    });
    describe('When nothing is returned', function () {
        test('should return empty series', function () {
            var response = {
                status: 'success',
                data: {
                    resultType: '',
                    result: null,
                },
            };
            var series = ctx.resultTransformer.transform({ data: response }, {});
            expect(series).toEqual([]);
        });
        test('should return empty table', function () {
            var response = {
                status: 'success',
                data: {
                    resultType: '',
                    result: null,
                },
            };
            var table = ctx.resultTransformer.transform({ data: response }, { format: 'table' });
            expect(table).toMatchObject([{ type: 'table', rows: [] }]);
        });
    });
    describe('When resultFormat is table', function () {
        var response = {
            status: 'success',
            data: {
                resultType: 'matrix',
                result: [
                    {
                        metric: { __name__: 'test', job: 'testjob' },
                        values: [[1443454528, '3846']],
                    },
                    {
                        metric: {
                            __name__: 'test',
                            instance: 'localhost:8080',
                            job: 'otherjob',
                        },
                        values: [[1443454529, '3847']],
                    },
                ],
            },
        };
        it('should return table model', function () {
            var table = ctx.resultTransformer.transformMetricDataToTable(response.data.result);
            expect(table.type).toBe('table');
            expect(table.rows).toEqual([
                [1443454528000, 'test', '', 'testjob', 3846],
                [1443454529000, 'test', 'localhost:8080', 'otherjob', 3847],
            ]);
            expect(table.columns).toMatchObject([
                { text: 'Time', type: 'time' },
                { text: '__name__', filterable: true },
                { text: 'instance', filterable: true },
                { text: 'job' },
                { text: 'Value' },
            ]);
            expect(table.columns[4].filterable).toBeUndefined();
        });
        it('should column title include refId if response count is more than 2', function () {
            var table = ctx.resultTransformer.transformMetricDataToTable(response.data.result, 2, 'B');
            expect(table.type).toBe('table');
            expect(table.columns).toMatchObject([
                { text: 'Time', type: 'time' },
                { text: '__name__' },
                { text: 'instance' },
                { text: 'job' },
                { text: 'Value #B' },
            ]);
        });
    });
    describe('When resultFormat is table and instant = true', function () {
        var response = {
            status: 'success',
            data: {
                resultType: 'vector',
                result: [
                    {
                        metric: { __name__: 'test', job: 'testjob' },
                        value: [1443454528, '3846'],
                    },
                ],
            },
        };
        it('should return table model', function () {
            var table = ctx.resultTransformer.transformMetricDataToTable(response.data.result);
            expect(table.type).toBe('table');
            expect(table.rows).toEqual([[1443454528000, 'test', 'testjob', 3846]]);
            expect(table.columns).toMatchObject([
                { text: 'Time', type: 'time' },
                { text: '__name__' },
                { text: 'job' },
                { text: 'Value' },
            ]);
        });
    });
    describe('When resultFormat is heatmap', function () {
        var response = {
            status: 'success',
            data: {
                resultType: 'matrix',
                result: [
                    {
                        metric: { __name__: 'test', job: 'testjob', le: '1' },
                        values: [[1445000010, '10'], [1445000020, '10'], [1445000030, '0']],
                    },
                    {
                        metric: { __name__: 'test', job: 'testjob', le: '2' },
                        values: [[1445000010, '20'], [1445000020, '10'], [1445000030, '30']],
                    },
                    {
                        metric: { __name__: 'test', job: 'testjob', le: '3' },
                        values: [[1445000010, '30'], [1445000020, '10'], [1445000030, '40']],
                    },
                ],
            },
        };
        it('should convert cumulative histogram to regular', function () {
            var options = {
                format: 'heatmap',
                start: 1445000010,
                end: 1445000030,
                legendFormat: '{{le}}',
            };
            var result = ctx.resultTransformer.transform({ data: response }, options);
            expect(result).toEqual([
                { target: '1', datapoints: [[10, 1445000010000], [10, 1445000020000], [0, 1445000030000]] },
                { target: '2', datapoints: [[10, 1445000010000], [0, 1445000020000], [30, 1445000030000]] },
                { target: '3', datapoints: [[10, 1445000010000], [0, 1445000020000], [10, 1445000030000]] },
            ]);
        });
        it('should handle missing datapoints', function () {
            var seriesList = [
                { datapoints: [[1, 1000], [2, 2000]] },
                { datapoints: [[2, 1000], [5, 2000], [1, 3000]] },
                { datapoints: [[3, 1000], [7, 2000]] },
            ];
            var expected = [
                { datapoints: [[1, 1000], [2, 2000]] },
                { datapoints: [[1, 1000], [3, 2000], [1, 3000]] },
                { datapoints: [[1, 1000], [2, 2000]] },
            ];
            var result = ctx.resultTransformer.transformToHistogramOverTime(seriesList);
            expect(result).toEqual(expected);
        });
        it('should throw error when data in wrong format', function () {
            var seriesList = [{ rows: [] }, { datapoints: [] }];
            expect(function () {
                ctx.resultTransformer.transformToHistogramOverTime(seriesList);
            }).toThrow();
        });
        it('should throw error when prometheus returned non-timeseries', function () {
            // should be { metric: {}, values: [] } for timeseries
            var metricData = { metric: {}, value: [] };
            expect(function () {
                ctx.resultTransformer.transformMetricData(metricData, { step: 1 }, 1000, 2000);
            }).toThrow();
        });
    });
    describe('When resultFormat is time series', function () {
        it('should transform matrix into timeseries', function () {
            var response = {
                status: 'success',
                data: {
                    resultType: 'matrix',
                    result: [
                        {
                            metric: { __name__: 'test', job: 'testjob' },
                            values: [[0, '10'], [1, '10'], [2, '0']],
                        },
                    ],
                },
            };
            var options = {
                format: 'timeseries',
                start: 0,
                end: 2,
            };
            var result = ctx.resultTransformer.transform({ data: response }, options);
            expect(result).toEqual([{ target: 'test{job="testjob"}', datapoints: [[10, 0], [10, 1000], [0, 2000]] }]);
        });
        it('should fill timeseries with null values', function () {
            var response = {
                status: 'success',
                data: {
                    resultType: 'matrix',
                    result: [
                        {
                            metric: { __name__: 'test', job: 'testjob' },
                            values: [[1, '10'], [2, '0']],
                        },
                    ],
                },
            };
            var options = {
                format: 'timeseries',
                step: 1,
                start: 0,
                end: 2,
            };
            var result = ctx.resultTransformer.transform({ data: response }, options);
            expect(result).toEqual([{ target: 'test{job="testjob"}', datapoints: [[null, 0], [10, 1000], [0, 2000]] }]);
        });
        it('should align null values with step', function () {
            var response = {
                status: 'success',
                data: {
                    resultType: 'matrix',
                    result: [
                        {
                            metric: { __name__: 'test', job: 'testjob' },
                            values: [[4, '10'], [8, '10']],
                        },
                    ],
                },
            };
            var options = {
                format: 'timeseries',
                step: 2,
                start: 0,
                end: 8,
            };
            var result = ctx.resultTransformer.transform({ data: response }, options);
            expect(result).toEqual([
                { target: 'test{job="testjob"}', datapoints: [[null, 0], [null, 2000], [10, 4000], [null, 6000], [10, 8000]] },
            ]);
        });
    });
});
//# sourceMappingURL=result_transformer.test.js.map