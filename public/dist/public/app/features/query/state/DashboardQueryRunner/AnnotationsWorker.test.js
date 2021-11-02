import { __assign, __awaiter, __generator } from "tslib";
import { Subject, throwError } from 'rxjs';
import { setDataSourceSrv } from '@grafana/runtime';
import { AnnotationsWorker } from './AnnotationsWorker';
import * as annotationsSrv from '../../../annotations/annotations_srv';
import { getDefaultOptions, LEGACY_DS_NAME, NEXT_GEN_DS_NAME, toAsyncOfResult } from './testHelpers';
import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
import { createDashboardQueryRunner, setDashboardQueryRunnerFactory } from './DashboardQueryRunner';
import { emptyResult } from './utils';
import { delay } from 'rxjs/operators';
function getTestContext(dataSourceSrvRejects) {
    var _this = this;
    if (dataSourceSrvRejects === void 0) { dataSourceSrvRejects = false; }
    jest.clearAllMocks();
    var cancellations = new Subject();
    setDashboardQueryRunnerFactory(function () { return ({
        getResult: emptyResult,
        run: function () { return undefined; },
        cancel: function () { return undefined; },
        cancellations: function () { return cancellations; },
        destroy: function () { return undefined; },
    }); });
    createDashboardQueryRunner({});
    var executeAnnotationQueryMock = jest
        .spyOn(annotationsSrv, 'executeAnnotationQuery')
        .mockReturnValue(toAsyncOfResult({ events: [{ id: 'NextGen' }] }));
    var annotationQueryMock = jest.fn().mockResolvedValue([{ id: 'Legacy' }]);
    var dataSourceSrvMock = {
        get: function (name) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (dataSourceSrvRejects) {
                    return [2 /*return*/, Promise.reject("Could not find datasource with name: " + name)];
                }
                if (name === LEGACY_DS_NAME) {
                    return [2 /*return*/, {
                            annotationQuery: annotationQueryMock,
                        }];
                }
                if (name === NEXT_GEN_DS_NAME) {
                    return [2 /*return*/, {
                            annotations: {},
                        }];
                }
                return [2 /*return*/, {}];
            });
        }); },
    };
    setDataSourceSrv(dataSourceSrvMock);
    var options = getDefaultOptions();
    return { options: options, annotationQueryMock: annotationQueryMock, executeAnnotationQueryMock: executeAnnotationQueryMock, cancellations: cancellations };
}
function expectOnResults(args) {
    var worker = args.worker, done = args.done, options = args.options, expectCallback = args.expect;
    var subscription = worker.work(options).subscribe({
        next: function (value) {
            try {
                expectCallback(value);
                subscription.unsubscribe();
                done();
            }
            catch (err) {
                subscription.unsubscribe();
                done.fail(err);
            }
        },
    });
}
describe('AnnotationsWorker', function () {
    var worker = new AnnotationsWorker();
    describe('when canWork is called with correct props', function () {
        it('then it should return true', function () {
            var options = getDefaultOptions();
            expect(worker.canWork(options)).toBe(true);
        });
    });
    describe('when canWork is called with incorrect props', function () {
        it('then it should return false', function () {
            var dashboard = { annotations: { list: [] } };
            var options = __assign(__assign({}, getDefaultOptions()), { dashboard: dashboard });
            expect(worker.canWork(options)).toBe(false);
        });
    });
    describe('when run is called with incorrect props', function () {
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var dashboard, options;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dashboard = { annotations: { list: [] } };
                        options = __assign(__assign({}, getDefaultOptions()), { dashboard: dashboard });
                        return [4 /*yield*/, expect(worker.work(options)).toEmitValues([{ alertStates: [], annotations: [] }])];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when run is called with correct props and all workers are successful', function () {
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, options, executeAnnotationQueryMock, annotationQueryMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext(), options = _a.options, executeAnnotationQueryMock = _a.executeAnnotationQueryMock, annotationQueryMock = _a.annotationQueryMock;
                        return [4 /*yield*/, expect(worker.work(options)).toEmitValuesWith(function (received) {
                                expect(received).toHaveLength(1);
                                var result = received[0];
                                expect(result).toEqual({
                                    alertStates: [],
                                    annotations: [
                                        {
                                            id: 'Legacy',
                                            source: {
                                                enable: true,
                                                hide: false,
                                                name: 'Test',
                                                iconColor: 'pink',
                                                snapshotData: undefined,
                                                datasource: 'Legacy',
                                            },
                                            color: '#ffc0cb',
                                            type: 'Test',
                                            isRegion: false,
                                        },
                                        {
                                            id: 'NextGen',
                                            source: {
                                                enable: true,
                                                hide: false,
                                                name: 'Test',
                                                iconColor: 'pink',
                                                snapshotData: undefined,
                                                datasource: 'NextGen',
                                            },
                                            color: '#ffc0cb',
                                            type: 'Test',
                                            isRegion: false,
                                        },
                                    ],
                                });
                                expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                                expect(annotationQueryMock).toHaveBeenCalledTimes(1);
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when run is called with correct props and legacy worker fails', function () {
        silenceConsoleOutput();
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, options, executeAnnotationQueryMock, annotationQueryMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext(), options = _a.options, executeAnnotationQueryMock = _a.executeAnnotationQueryMock, annotationQueryMock = _a.annotationQueryMock;
                        annotationQueryMock.mockRejectedValue({ message: 'Some error' });
                        return [4 /*yield*/, expect(worker.work(options)).toEmitValuesWith(function (received) {
                                expect(received).toHaveLength(1);
                                var result = received[0];
                                expect(result).toEqual({
                                    alertStates: [],
                                    annotations: [
                                        {
                                            id: 'NextGen',
                                            source: {
                                                enable: true,
                                                hide: false,
                                                name: 'Test',
                                                iconColor: 'pink',
                                                snapshotData: undefined,
                                                datasource: 'NextGen',
                                            },
                                            color: '#ffc0cb',
                                            type: 'Test',
                                            isRegion: false,
                                        },
                                    ],
                                });
                                expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                                expect(annotationQueryMock).toHaveBeenCalledTimes(1);
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when run is called with correct props and a worker is cancelled', function () {
        it('then it should return the correct results', function (done) {
            var _a = getTestContext(), options = _a.options, executeAnnotationQueryMock = _a.executeAnnotationQueryMock, annotationQueryMock = _a.annotationQueryMock, cancellations = _a.cancellations;
            executeAnnotationQueryMock.mockReturnValueOnce(toAsyncOfResult({ events: [{ id: 'NextGen' }] }).pipe(delay(10000)));
            expectOnResults({
                worker: worker,
                options: options,
                done: done,
                expect: function (results) {
                    expect(results).toEqual({
                        alertStates: [],
                        annotations: [
                            {
                                id: 'Legacy',
                                source: {
                                    enable: true,
                                    hide: false,
                                    name: 'Test',
                                    iconColor: 'pink',
                                    snapshotData: undefined,
                                    datasource: 'Legacy',
                                },
                                color: '#ffc0cb',
                                type: 'Test',
                                isRegion: false,
                            },
                        ],
                    });
                    expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                    expect(annotationQueryMock).toHaveBeenCalledTimes(1);
                },
            });
            setTimeout(function () {
                // call to async needs to be async or the cancellation will be called before any of the runners have started
                cancellations.next(options.dashboard.annotations.list[1]);
            }, 100);
        });
    });
    describe('when run is called with correct props and nextgen worker fails', function () {
        silenceConsoleOutput();
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, options, executeAnnotationQueryMock, annotationQueryMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext(), options = _a.options, executeAnnotationQueryMock = _a.executeAnnotationQueryMock, annotationQueryMock = _a.annotationQueryMock;
                        executeAnnotationQueryMock.mockReturnValue(throwError({ message: 'An error' }));
                        return [4 /*yield*/, expect(worker.work(options)).toEmitValuesWith(function (received) {
                                expect(received).toHaveLength(1);
                                var result = received[0];
                                expect(result).toEqual({
                                    alertStates: [],
                                    annotations: [
                                        {
                                            id: 'Legacy',
                                            source: {
                                                enable: true,
                                                hide: false,
                                                name: 'Test',
                                                iconColor: 'pink',
                                                snapshotData: undefined,
                                                datasource: 'Legacy',
                                            },
                                            color: '#ffc0cb',
                                            type: 'Test',
                                            isRegion: false,
                                        },
                                    ],
                                });
                                expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                                expect(annotationQueryMock).toHaveBeenCalledTimes(1);
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when run is called with correct props and both workers fail', function () {
        silenceConsoleOutput();
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, options, executeAnnotationQueryMock, annotationQueryMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext(), options = _a.options, executeAnnotationQueryMock = _a.executeAnnotationQueryMock, annotationQueryMock = _a.annotationQueryMock;
                        annotationQueryMock.mockRejectedValue({ message: 'Some error' });
                        executeAnnotationQueryMock.mockReturnValue(throwError({ message: 'An error' }));
                        return [4 /*yield*/, expect(worker.work(options)).toEmitValuesWith(function (received) {
                                expect(received).toHaveLength(1);
                                var result = received[0];
                                expect(result).toEqual({ alertStates: [], annotations: [] });
                                expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                                expect(annotationQueryMock).toHaveBeenCalledTimes(1);
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when run is called with correct props and call to datasourceSrv fails', function () {
        silenceConsoleOutput();
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, options, executeAnnotationQueryMock, annotationQueryMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext(true), options = _a.options, executeAnnotationQueryMock = _a.executeAnnotationQueryMock, annotationQueryMock = _a.annotationQueryMock;
                        return [4 /*yield*/, expect(worker.work(options)).toEmitValuesWith(function (received) {
                                expect(received).toHaveLength(1);
                                var result = received[0];
                                expect(result).toEqual({ alertStates: [], annotations: [] });
                                expect(executeAnnotationQueryMock).not.toHaveBeenCalled();
                                expect(annotationQueryMock).not.toHaveBeenCalled();
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=AnnotationsWorker.test.js.map