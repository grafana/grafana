import { __awaiter, __generator, __read } from "tslib";
import { ArrayVector, FieldType, getDefaultRelativeTimeRange, LoadingState, rangeUtil, } from '@grafana/data';
import { of, throwError } from 'rxjs';
import { delay, take } from 'rxjs/operators';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { AlertingQueryRunner } from './AlertingQueryRunner';
describe('AlertingQueryRunner', function () {
    it('should successfully map response and return panel data by refId', function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, runner, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    response = createFetchResponse({
                        results: {
                            A: { frames: [createDataFrameJSON([1, 2, 3])] },
                            B: { frames: [createDataFrameJSON([5, 6])] },
                        },
                    });
                    runner = new AlertingQueryRunner(mockBackendSrv({
                        fetch: function () { return of(response); },
                    }));
                    data = runner.get();
                    runner.run([createQuery('A'), createQuery('B')]);
                    return [4 /*yield*/, expect(data.pipe(take(1))).toEmitValuesWith(function (values) {
                            var _a = __read(values, 1), data = _a[0];
                            expect(data).toEqual({
                                A: {
                                    annotations: [],
                                    state: LoadingState.Done,
                                    series: [
                                        expectDataFrameWithValues({
                                            time: [1620051612238, 1620051622238, 1620051632238],
                                            values: [1, 2, 3],
                                        }),
                                    ],
                                    structureRev: 1,
                                    timeRange: expect.anything(),
                                    timings: {
                                        dataProcessingTime: expect.any(Number),
                                    },
                                },
                                B: {
                                    annotations: [],
                                    state: LoadingState.Done,
                                    series: [
                                        expectDataFrameWithValues({
                                            time: [1620051612238, 1620051622238],
                                            values: [5, 6],
                                        }),
                                    ],
                                    structureRev: 1,
                                    timeRange: expect.anything(),
                                    timings: {
                                        dataProcessingTime: expect.any(Number),
                                    },
                                },
                            });
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should successfully map response with sliding relative time range', function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, runner, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    response = createFetchResponse({
                        results: {
                            A: { frames: [createDataFrameJSON([1, 2, 3])] },
                            B: { frames: [createDataFrameJSON([5, 6])] },
                        },
                    });
                    runner = new AlertingQueryRunner(mockBackendSrv({
                        fetch: function () { return of(response); },
                    }));
                    data = runner.get();
                    runner.run([createQuery('A'), createQuery('B')]);
                    return [4 /*yield*/, expect(data.pipe(take(1))).toEmitValuesWith(function (values) {
                            var _a = __read(values, 1), data = _a[0];
                            var relativeA = rangeUtil.timeRangeToRelative(data.A.timeRange);
                            var relativeB = rangeUtil.timeRangeToRelative(data.B.timeRange);
                            var expected = getDefaultRelativeTimeRange();
                            expect(relativeA).toEqual(expected);
                            expect(relativeB).toEqual(expected);
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should emit loading state if response is slower then 200ms', function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, runner, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    response = createFetchResponse({
                        results: {
                            A: { frames: [createDataFrameJSON([1, 2, 3])] },
                            B: { frames: [createDataFrameJSON([5, 6])] },
                        },
                    });
                    runner = new AlertingQueryRunner(mockBackendSrv({
                        fetch: function () { return of(response).pipe(delay(210)); },
                    }));
                    data = runner.get();
                    runner.run([createQuery('A'), createQuery('B')]);
                    return [4 /*yield*/, expect(data.pipe(take(2))).toEmitValuesWith(function (values) {
                            var _a = __read(values, 2), loading = _a[0], data = _a[1];
                            expect(loading.A.state).toEqual(LoadingState.Loading);
                            expect(loading.B.state).toEqual(LoadingState.Loading);
                            expect(data).toEqual({
                                A: {
                                    annotations: [],
                                    state: LoadingState.Done,
                                    series: [
                                        expectDataFrameWithValues({
                                            time: [1620051612238, 1620051622238, 1620051632238],
                                            values: [1, 2, 3],
                                        }),
                                    ],
                                    structureRev: 2,
                                    timeRange: expect.anything(),
                                    timings: {
                                        dataProcessingTime: expect.any(Number),
                                    },
                                },
                                B: {
                                    annotations: [],
                                    state: LoadingState.Done,
                                    series: [
                                        expectDataFrameWithValues({
                                            time: [1620051612238, 1620051622238],
                                            values: [5, 6],
                                        }),
                                    ],
                                    structureRev: 2,
                                    timeRange: expect.anything(),
                                    timings: {
                                        dataProcessingTime: expect.any(Number),
                                    },
                                },
                            });
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should emit error state if fetch request fails', function () { return __awaiter(void 0, void 0, void 0, function () {
        var error, runner, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    error = new Error('could not query data');
                    runner = new AlertingQueryRunner(mockBackendSrv({
                        fetch: function () { return throwError(error); },
                    }));
                    data = runner.get();
                    runner.run([createQuery('A'), createQuery('B')]);
                    return [4 /*yield*/, expect(data.pipe(take(1))).toEmitValuesWith(function (values) {
                            var _a = __read(values, 1), data = _a[0];
                            expect(data.A.state).toEqual(LoadingState.Error);
                            expect(data.A.error).toEqual(error);
                            expect(data.B.state).toEqual(LoadingState.Error);
                            expect(data.B.error).toEqual(error);
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
var mockBackendSrv = function (_a) {
    var fetch = _a.fetch;
    return {
        fetch: fetch,
        resolveCancelerIfExists: jest.fn(),
    };
};
var expectDataFrameWithValues = function (_a) {
    var time = _a.time, values = _a.values;
    return {
        fields: [
            {
                config: {},
                entities: {},
                name: 'time',
                state: null,
                type: FieldType.time,
                values: new ArrayVector(time),
            },
            {
                config: {},
                entities: {},
                name: 'value',
                state: null,
                type: FieldType.number,
                values: new ArrayVector(values),
            },
        ],
        length: values.length,
    };
};
var createDataFrameJSON = function (values) {
    var startTime = 1620051602238;
    var timeValues = values.map(function (_, index) { return startTime + (index + 1) * 10000; });
    return {
        schema: {
            fields: [
                { name: 'time', type: FieldType.time },
                { name: 'value', type: FieldType.number },
            ],
        },
        data: {
            values: [timeValues, values],
        },
    };
};
var createQuery = function (refId) {
    return {
        refId: refId,
        queryType: '',
        datasourceUid: '',
        model: { refId: refId },
        relativeTimeRange: getDefaultRelativeTimeRange(),
    };
};
//# sourceMappingURL=AlertingQueryRunner.test.js.map