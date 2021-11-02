import { __assign } from "tslib";
import { FieldType, MutableDataFrame } from '@grafana/data';
import { transform, transformV2, transformDFToTable } from './result_transformer';
jest.mock('@grafana/runtime', function () { return ({
    getTemplateSrv: function () { return ({
        replace: function (str) { return str; },
    }); },
    getDataSourceSrv: function () {
        return {
            getInstanceSettings: function () {
                return { name: 'Tempo' };
            },
        };
    },
}); });
var matrixResponse = {
    status: 'success',
    data: {
        resultType: 'matrix',
        result: [
            {
                metric: { __name__: 'test', job: 'testjob' },
                values: [
                    [1, '10'],
                    [2, '0'],
                ],
            },
        ],
    },
};
describe('Prometheus Result Transformer', function () {
    describe('transformV2', function () {
        it('results with time_series format should be enriched with preferredVisualisationType', function () {
            var request = {
                targets: [
                    {
                        format: 'time_series',
                        refId: 'A',
                    },
                ],
            };
            var response = {
                state: 'Done',
                data: [
                    {
                        fields: [],
                        length: 2,
                        name: 'ALERTS',
                        refId: 'A',
                    },
                ],
            };
            var series = transformV2(response, request, {});
            expect(series).toEqual({
                data: [{ fields: [], length: 2, meta: { preferredVisualisationType: 'graph' }, name: 'ALERTS', refId: 'A' }],
                state: 'Done',
            });
        });
        it('results with table format should be transformed to table dataFrames', function () {
            var _a;
            var request = {
                targets: [
                    {
                        format: 'table',
                        refId: 'A',
                    },
                ],
            };
            var response = {
                state: 'Done',
                data: [
                    new MutableDataFrame({
                        refId: 'A',
                        fields: [
                            { name: 'time', type: FieldType.time, values: [6, 5, 4] },
                            {
                                name: 'value',
                                type: FieldType.number,
                                values: [6, 5, 4],
                                labels: { label1: 'value1', label2: 'value2' },
                            },
                        ],
                    }),
                ],
            };
            var series = transformV2(response, request, {});
            expect(series.data[0].fields[0].name).toEqual('Time');
            expect(series.data[0].fields[1].name).toEqual('label1');
            expect(series.data[0].fields[2].name).toEqual('label2');
            expect(series.data[0].fields[3].name).toEqual('Value');
            expect((_a = series.data[0].meta) === null || _a === void 0 ? void 0 : _a.preferredVisualisationType).toEqual('table');
        });
        it('results with table format and multiple data frames should be transformed to 1 table dataFrame', function () {
            var _a;
            var request = {
                targets: [
                    {
                        format: 'table',
                        refId: 'A',
                    },
                ],
            };
            var response = {
                state: 'Done',
                data: [
                    new MutableDataFrame({
                        refId: 'A',
                        fields: [
                            { name: 'time', type: FieldType.time, values: [6, 5, 4] },
                            {
                                name: 'value',
                                type: FieldType.number,
                                values: [6, 5, 4],
                                labels: { label1: 'value1', label2: 'value2' },
                            },
                        ],
                    }),
                    new MutableDataFrame({
                        refId: 'A',
                        fields: [
                            { name: 'time', type: FieldType.time, values: [2, 3, 7] },
                            {
                                name: 'value',
                                type: FieldType.number,
                                values: [2, 3, 7],
                                labels: { label3: 'value3', label4: 'value4' },
                            },
                        ],
                    }),
                ],
            };
            var series = transformV2(response, request, {});
            expect(series.data.length).toEqual(1);
            expect(series.data[0].fields[0].name).toEqual('Time');
            expect(series.data[0].fields[1].name).toEqual('label1');
            expect(series.data[0].fields[2].name).toEqual('label2');
            expect(series.data[0].fields[3].name).toEqual('label3');
            expect(series.data[0].fields[4].name).toEqual('label4');
            expect(series.data[0].fields[5].name).toEqual('Value #A');
            expect((_a = series.data[0].meta) === null || _a === void 0 ? void 0 : _a.preferredVisualisationType).toEqual('table');
        });
        it('results with table and time_series format should be correctly transformed', function () {
            var _a, _b;
            var options = {
                targets: [
                    {
                        format: 'table',
                        refId: 'A',
                    },
                    {
                        format: 'time_series',
                        refId: 'B',
                    },
                ],
            };
            var response = {
                state: 'Done',
                data: [
                    new MutableDataFrame({
                        refId: 'A',
                        fields: [
                            { name: 'time', type: FieldType.time, values: [6, 5, 4] },
                            {
                                name: 'value',
                                type: FieldType.number,
                                values: [6, 5, 4],
                                labels: { label1: 'value1', label2: 'value2' },
                            },
                        ],
                    }),
                    new MutableDataFrame({
                        refId: 'B',
                        fields: [
                            { name: 'time', type: FieldType.time, values: [6, 5, 4] },
                            {
                                name: 'value',
                                type: FieldType.number,
                                values: [6, 5, 4],
                                labels: { label1: 'value1', label2: 'value2' },
                            },
                        ],
                    }),
                ],
            };
            var series = transformV2(response, options, {});
            expect(series.data[0].fields.length).toEqual(2);
            expect((_a = series.data[0].meta) === null || _a === void 0 ? void 0 : _a.preferredVisualisationType).toEqual('graph');
            expect(series.data[1].fields.length).toEqual(4);
            expect((_b = series.data[1].meta) === null || _b === void 0 ? void 0 : _b.preferredVisualisationType).toEqual('table');
        });
        it('results with heatmap format should be correctly transformed', function () {
            var options = {
                targets: [
                    {
                        format: 'heatmap',
                        refId: 'A',
                    },
                ],
            };
            var response = {
                state: 'Done',
                data: [
                    new MutableDataFrame({
                        refId: 'A',
                        fields: [
                            { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
                            {
                                name: 'Value',
                                type: FieldType.number,
                                values: [10, 10, 0],
                                labels: { le: '1' },
                            },
                        ],
                    }),
                    new MutableDataFrame({
                        refId: 'A',
                        fields: [
                            { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
                            {
                                name: 'Value',
                                type: FieldType.number,
                                values: [20, 10, 30],
                                labels: { le: '2' },
                            },
                        ],
                    }),
                    new MutableDataFrame({
                        refId: 'A',
                        fields: [
                            { name: 'Time', type: FieldType.time, values: [6, 5, 4] },
                            {
                                name: 'Value',
                                type: FieldType.number,
                                values: [30, 10, 40],
                                labels: { le: '3' },
                            },
                        ],
                    }),
                ],
            };
            var series = transformV2(response, options, {});
            expect(series.data[0].fields.length).toEqual(2);
            expect(series.data[0].fields[1].values.toArray()).toEqual([10, 10, 0]);
            expect(series.data[1].fields[1].values.toArray()).toEqual([10, 0, 30]);
            expect(series.data[2].fields[1].values.toArray()).toEqual([10, 0, 10]);
        });
    });
    describe('transformDFToTable', function () {
        it('transforms dataFrame with response length 1 to table dataFrame', function () {
            var df = new MutableDataFrame({
                refId: 'A',
                fields: [
                    { name: 'time', type: FieldType.time, values: [6, 5, 4] },
                    {
                        name: 'value',
                        type: FieldType.number,
                        values: [6, 5, 4],
                        labels: { label1: 'value1', label2: 'value2' },
                    },
                ],
            });
            var tableDf = transformDFToTable([df])[0];
            expect(tableDf.fields.length).toBe(4);
            expect(tableDf.fields[0].name).toBe('Time');
            expect(tableDf.fields[1].name).toBe('label1');
            expect(tableDf.fields[1].values.get(0)).toBe('value1');
            expect(tableDf.fields[2].name).toBe('label2');
            expect(tableDf.fields[2].values.get(0)).toBe('value2');
            expect(tableDf.fields[3].name).toBe('Value');
        });
        it('transforms dataFrame with response length 2 to table dataFrame', function () {
            var df = new MutableDataFrame({
                refId: 'A',
                fields: [
                    { name: 'time', type: FieldType.time, values: [6, 5, 4] },
                    {
                        name: 'value',
                        type: FieldType.number,
                        values: [6, 5, 4],
                        labels: { label1: 'value1', label2: 'value2' },
                    },
                ],
            });
            var tableDf = transformDFToTable([df])[0];
            expect(tableDf.fields.length).toBe(4);
            expect(tableDf.fields[0].name).toBe('Time');
            expect(tableDf.fields[1].name).toBe('label1');
            expect(tableDf.fields[1].values.get(0)).toBe('value1');
            expect(tableDf.fields[2].name).toBe('label2');
            expect(tableDf.fields[2].values.get(0)).toBe('value2');
            expect(tableDf.fields[3].name).toBe('Value');
        });
    });
    describe('transform', function () {
        var options = { target: {}, query: {} };
        describe('When nothing is returned', function () {
            it('should return empty array', function () {
                var response = {
                    status: 'success',
                    data: {
                        resultType: '',
                        result: null,
                    },
                };
                var series = transform({ data: response }, options);
                expect(series).toEqual([]);
            });
            it('should return empty array', function () {
                var response = {
                    status: 'success',
                    data: {
                        resultType: '',
                        result: null,
                    },
                };
                var result = transform({ data: response }, __assign(__assign({}, options), { target: { format: 'table' } }));
                expect(result).toHaveLength(0);
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
                            values: [
                                [1443454528, '3846'],
                                [1443454530, '3848'],
                            ],
                        },
                        {
                            metric: {
                                __name__: 'test2',
                                instance: 'localhost:8080',
                                job: 'otherjob',
                            },
                            values: [
                                [1443454529, '3847'],
                                [1443454531, '3849'],
                            ],
                        },
                    ],
                },
            };
            it('should return data frame', function () {
                var result = transform({ data: response }, __assign(__assign({}, options), { target: {
                        responseListLength: 0,
                        refId: 'A',
                        format: 'table',
                    } }));
                expect(result[0].fields[0].values.toArray()).toEqual([
                    1443454528000,
                    1443454530000,
                    1443454529000,
                    1443454531000,
                ]);
                expect(result[0].fields[0].name).toBe('Time');
                expect(result[0].fields[0].type).toBe(FieldType.time);
                expect(result[0].fields[1].values.toArray()).toEqual(['test', 'test', 'test2', 'test2']);
                expect(result[0].fields[1].name).toBe('__name__');
                expect(result[0].fields[1].config.filterable).toBe(true);
                expect(result[0].fields[1].type).toBe(FieldType.string);
                expect(result[0].fields[2].values.toArray()).toEqual(['', '', 'localhost:8080', 'localhost:8080']);
                expect(result[0].fields[2].name).toBe('instance');
                expect(result[0].fields[2].type).toBe(FieldType.string);
                expect(result[0].fields[3].values.toArray()).toEqual(['testjob', 'testjob', 'otherjob', 'otherjob']);
                expect(result[0].fields[3].name).toBe('job');
                expect(result[0].fields[3].type).toBe(FieldType.string);
                expect(result[0].fields[4].values.toArray()).toEqual([3846, 3848, 3847, 3849]);
                expect(result[0].fields[4].name).toEqual('Value');
                expect(result[0].fields[4].type).toBe(FieldType.number);
                expect(result[0].refId).toBe('A');
            });
            it('should include refId if response count is more than 2', function () {
                var result = transform({ data: response }, __assign(__assign({}, options), { target: {
                        refId: 'B',
                        format: 'table',
                    }, responseListLength: 2 }));
                expect(result[0].fields[4].name).toEqual('Value #B');
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
            it('should return data frame', function () {
                var result = transform({ data: response }, __assign(__assign({}, options), { target: { format: 'table' } }));
                expect(result[0].fields[0].values.toArray()).toEqual([1443454528000]);
                expect(result[0].fields[0].name).toBe('Time');
                expect(result[0].fields[1].values.toArray()).toEqual(['test']);
                expect(result[0].fields[1].name).toBe('__name__');
                expect(result[0].fields[2].values.toArray()).toEqual(['testjob']);
                expect(result[0].fields[2].name).toBe('job');
                expect(result[0].fields[3].values.toArray()).toEqual([3846]);
                expect(result[0].fields[3].name).toEqual('Value');
            });
            it('should return le label values parsed as numbers', function () {
                var response = {
                    status: 'success',
                    data: {
                        resultType: 'vector',
                        result: [
                            {
                                metric: { le: '102' },
                                value: [1594908838, '0'],
                            },
                        ],
                    },
                };
                var result = transform({ data: response }, __assign(__assign({}, options), { target: { format: 'table' } }));
                expect(result[0].fields[1].values.toArray()).toEqual([102]);
                expect(result[0].fields[1].type).toEqual(FieldType.number);
            });
        });
        describe('When instant = true', function () {
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
            it('should return data frame', function () {
                var result = transform({ data: response }, __assign(__assign({}, options), { query: { instant: true } }));
                expect(result[0].name).toBe('test{job="testjob"}');
            });
        });
        describe('When resultFormat is heatmap', function () {
            var getResponse = function (result) { return ({
                status: 'success',
                data: {
                    resultType: 'matrix',
                    result: result,
                },
            }); };
            var options = {
                format: 'heatmap',
                start: 1445000010,
                end: 1445000030,
                legendFormat: '{{le}}',
            };
            it('should convert cumulative histogram to regular', function () {
                var response = getResponse([
                    {
                        metric: { __name__: 'test', job: 'testjob', le: '1' },
                        values: [
                            [1445000010, '10'],
                            [1445000020, '10'],
                            [1445000030, '0'],
                        ],
                    },
                    {
                        metric: { __name__: 'test', job: 'testjob', le: '2' },
                        values: [
                            [1445000010, '20'],
                            [1445000020, '10'],
                            [1445000030, '30'],
                        ],
                    },
                    {
                        metric: { __name__: 'test', job: 'testjob', le: '3' },
                        values: [
                            [1445000010, '30'],
                            [1445000020, '10'],
                            [1445000030, '40'],
                        ],
                    },
                ]);
                var result = transform({ data: response }, { query: options, target: options });
                expect(result[0].fields[0].values.toArray()).toEqual([1445000010000, 1445000020000, 1445000030000]);
                expect(result[0].fields[1].values.toArray()).toEqual([10, 10, 0]);
                expect(result[1].fields[0].values.toArray()).toEqual([1445000010000, 1445000020000, 1445000030000]);
                expect(result[1].fields[1].values.toArray()).toEqual([10, 0, 30]);
                expect(result[2].fields[0].values.toArray()).toEqual([1445000010000, 1445000020000, 1445000030000]);
                expect(result[2].fields[1].values.toArray()).toEqual([10, 0, 10]);
            });
            it('should handle missing datapoints', function () {
                var response = getResponse([
                    {
                        metric: { __name__: 'test', job: 'testjob', le: '1' },
                        values: [
                            [1445000010, '1'],
                            [1445000020, '2'],
                        ],
                    },
                    {
                        metric: { __name__: 'test', job: 'testjob', le: '2' },
                        values: [
                            [1445000010, '2'],
                            [1445000020, '5'],
                            [1445000030, '1'],
                        ],
                    },
                    {
                        metric: { __name__: 'test', job: 'testjob', le: '3' },
                        values: [
                            [1445000010, '3'],
                            [1445000020, '7'],
                        ],
                    },
                ]);
                var result = transform({ data: response }, { query: options, target: options });
                expect(result[0].fields[1].values.toArray()).toEqual([1, 2]);
                expect(result[1].fields[1].values.toArray()).toEqual([1, 3, 1]);
                expect(result[2].fields[1].values.toArray()).toEqual([1, 2]);
            });
        });
        describe('When the response is a matrix', function () {
            it('should have labels with the value field', function () {
                var _a, _b;
                var response = {
                    status: 'success',
                    data: {
                        resultType: 'matrix',
                        result: [
                            {
                                metric: { __name__: 'test', job: 'testjob', instance: 'testinstance' },
                                values: [
                                    [0, '10'],
                                    [1, '10'],
                                    [2, '0'],
                                ],
                            },
                        ],
                    },
                };
                var result = transform({ data: response }, __assign({}, options));
                expect(result[0].fields[1].labels).toBeDefined();
                expect((_a = result[0].fields[1].labels) === null || _a === void 0 ? void 0 : _a.instance).toBe('testinstance');
                expect((_b = result[0].fields[1].labels) === null || _b === void 0 ? void 0 : _b.job).toBe('testjob');
            });
            it('should transform into a data frame', function () {
                var response = {
                    status: 'success',
                    data: {
                        resultType: 'matrix',
                        result: [
                            {
                                metric: { __name__: 'test', job: 'testjob' },
                                values: [
                                    [0, '10'],
                                    [1, '10'],
                                    [2, '0'],
                                ],
                            },
                        ],
                    },
                };
                var result = transform({ data: response }, __assign(__assign({}, options), { query: {
                        start: 0,
                        end: 2,
                    } }));
                expect(result[0].fields[0].values.toArray()).toEqual([0, 1000, 2000]);
                expect(result[0].fields[1].values.toArray()).toEqual([10, 10, 0]);
                expect(result[0].name).toBe('test{job="testjob"}');
            });
            it('should fill null values', function () {
                var result = transform({ data: matrixResponse }, __assign(__assign({}, options), { query: { step: 1, start: 0, end: 2 } }));
                expect(result[0].fields[0].values.toArray()).toEqual([0, 1000, 2000]);
                expect(result[0].fields[1].values.toArray()).toEqual([null, 10, 0]);
            });
            it('should use __name__ label as series name', function () {
                var result = transform({ data: matrixResponse }, __assign(__assign({}, options), { query: {
                        step: 1,
                        start: 0,
                        end: 2,
                    } }));
                expect(result[0].name).toEqual('test{job="testjob"}');
            });
            it('should use query as series name when __name__ is not available and metric is empty', function () {
                var response = {
                    status: 'success',
                    data: {
                        resultType: 'matrix',
                        result: [
                            {
                                metric: {},
                                values: [[0, '10']],
                            },
                        ],
                    },
                };
                var expr = 'histogram_quantile(0.95, sum(rate(tns_request_duration_seconds_bucket[5m])) by (le))';
                var result = transform({ data: response }, __assign(__assign({}, options), { query: {
                        step: 1,
                        start: 0,
                        end: 2,
                        expr: expr,
                    } }));
                expect(result[0].name).toEqual(expr);
            });
            it('should set frame name to undefined if no __name__ label but there are other labels', function () {
                var response = {
                    status: 'success',
                    data: {
                        resultType: 'matrix',
                        result: [
                            {
                                metric: { job: 'testjob' },
                                values: [
                                    [1, '10'],
                                    [2, '0'],
                                ],
                            },
                        ],
                    },
                };
                var result = transform({ data: response }, __assign(__assign({}, options), { query: {
                        step: 1,
                        start: 0,
                        end: 2,
                    } }));
                expect(result[0].name).toBe('{job="testjob"}');
            });
            it('should not set displayName for ValueFields', function () {
                var result = transform({ data: matrixResponse }, options);
                expect(result[0].fields[1].config.displayName).toBeUndefined();
                expect(result[0].fields[1].config.displayNameFromDS).toBe('test{job="testjob"}');
            });
            it('should align null values with step', function () {
                var response = {
                    status: 'success',
                    data: {
                        resultType: 'matrix',
                        result: [
                            {
                                metric: { __name__: 'test', job: 'testjob' },
                                values: [
                                    [4, '10'],
                                    [8, '10'],
                                ],
                            },
                        ],
                    },
                };
                var result = transform({ data: response }, __assign(__assign({}, options), { query: { step: 2, start: 0, end: 8 } }));
                expect(result[0].fields[0].values.toArray()).toEqual([0, 2000, 4000, 6000, 8000]);
                expect(result[0].fields[1].values.toArray()).toEqual([null, null, 10, null, 10]);
            });
        });
        describe('When infinity values are returned', function () {
            describe('When resultType is scalar', function () {
                var response = {
                    status: 'success',
                    data: {
                        resultType: 'scalar',
                        result: [1443454528, '+Inf'],
                    },
                };
                it('should correctly parse values', function () {
                    var result = transform({ data: response }, __assign(__assign({}, options), { target: { format: 'table' } }));
                    expect(result[0].fields[1].values.toArray()).toEqual([Number.POSITIVE_INFINITY]);
                });
            });
            describe('When resultType is vector', function () {
                var response = {
                    status: 'success',
                    data: {
                        resultType: 'vector',
                        result: [
                            {
                                metric: { __name__: 'test', job: 'testjob' },
                                value: [1443454528, '+Inf'],
                            },
                            {
                                metric: { __name__: 'test', job: 'testjob' },
                                value: [1443454528, '-Inf'],
                            },
                        ],
                    },
                };
                describe('When format is table', function () {
                    it('should correctly parse values', function () {
                        var result = transform({ data: response }, __assign(__assign({}, options), { target: { format: 'table' } }));
                        expect(result[0].fields[3].values.toArray()).toEqual([Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]);
                    });
                });
            });
        });
        var exemplarsResponse = {
            status: 'success',
            data: [
                {
                    seriesLabels: { __name__: 'test' },
                    exemplars: [
                        {
                            timestamp: 1610449069.957,
                            labels: { traceID: '5020b5bc45117f07' },
                            value: 0.002074123,
                        },
                    ],
                },
            ],
        };
        describe('When the response is exemplar data', function () {
            it('should return as an data frame with a dataTopic annotations', function () {
                var _a;
                var result = transform({ data: exemplarsResponse }, options);
                expect((_a = result[0].meta) === null || _a === void 0 ? void 0 : _a.dataTopic).toBe('annotations');
                expect(result[0].fields.length).toBe(4); // __name__, traceID, Time, Value
                expect(result[0].length).toBe(1);
            });
            it('should return with an empty array when data is empty', function () {
                var result = transform({
                    data: {
                        status: 'success',
                        data: [],
                    },
                }, options);
                expect(result).toHaveLength(0);
            });
            it('should remove exemplars that are too close to each other', function () {
                var response = {
                    status: 'success',
                    data: [
                        {
                            exemplars: [
                                {
                                    timestamp: 1610449070.0,
                                    value: 5,
                                },
                                {
                                    timestamp: 1610449070.0,
                                    value: 1,
                                },
                                {
                                    timestamp: 1610449070.5,
                                    value: 13,
                                },
                                {
                                    timestamp: 1610449070.3,
                                    value: 20,
                                },
                            ],
                        },
                    ],
                };
                /**
                 * the standard deviation for the above values is 8.4 this means that we show the highest
                 * value (20) and then the next value should be 2 times the standard deviation which is 1
                 **/
                var result = transform({ data: response }, options);
                expect(result[0].length).toBe(2);
            });
            describe('data link', function () {
                it('should be added to the field if found with url', function () {
                    var result = transform({ data: exemplarsResponse }, __assign(__assign({}, options), { exemplarTraceIdDestinations: [{ name: 'traceID', url: 'http://localhost' }] }));
                    expect(result[0].fields.some(function (f) { var _a; return (_a = f.config.links) === null || _a === void 0 ? void 0 : _a.length; })).toBe(true);
                });
                it('should be added to the field if found with internal link', function () {
                    var result = transform({ data: exemplarsResponse }, __assign(__assign({}, options), { exemplarTraceIdDestinations: [{ name: 'traceID', datasourceUid: 'jaeger' }] }));
                    expect(result[0].fields.some(function (f) { var _a; return (_a = f.config.links) === null || _a === void 0 ? void 0 : _a.length; })).toBe(true);
                });
                it('should not add link if exemplarTraceIdDestinations is not configured', function () {
                    var result = transform({ data: exemplarsResponse }, options);
                    expect(result[0].fields.some(function (f) { var _a; return (_a = f.config.links) === null || _a === void 0 ? void 0 : _a.length; })).toBe(false);
                });
            });
        });
    });
});
//# sourceMappingURL=result_transformer.test.js.map