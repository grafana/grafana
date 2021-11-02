import { __assign, __awaiter, __generator } from "tslib";
import { getDefaultTimeRange } from '@grafana/data';
import { AnnotationsQueryRunner } from './AnnotationsQueryRunner';
import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
import * as store from '../../../../store/store';
import * as annotationsSrv from '../../../annotations/annotations_srv';
import { of, throwError } from 'rxjs';
import { toAsyncOfResult } from './testHelpers';
function getDefaultOptions() {
    var annotation = {};
    var dashboard = {};
    var datasource = {
        annotationQuery: {},
        annotations: {},
    };
    var range = getDefaultTimeRange();
    return { annotation: annotation, datasource: datasource, dashboard: dashboard, range: range };
}
function getTestContext(result) {
    if (result === void 0) { result = toAsyncOfResult({ events: [{ id: '1' }] }); }
    jest.clearAllMocks();
    var dispatchMock = jest.spyOn(store, 'dispatch');
    var options = getDefaultOptions();
    var executeAnnotationQueryMock = jest.spyOn(annotationsSrv, 'executeAnnotationQuery').mockReturnValue(result);
    return { options: options, dispatchMock: dispatchMock, executeAnnotationQueryMock: executeAnnotationQueryMock };
}
describe('AnnotationsQueryRunner', function () {
    var runner = new AnnotationsQueryRunner();
    describe('when canWork is called with correct props', function () {
        it('then it should return true', function () {
            var datasource = {
                annotationQuery: jest.fn(),
                annotations: {},
            };
            expect(runner.canRun(datasource)).toBe(true);
        });
    });
    describe('when canWork is called without datasource', function () {
        it('then it should return false', function () {
            var datasource = undefined;
            expect(runner.canRun(datasource)).toBe(false);
        });
    });
    describe('when canWork is called with incorrect props', function () {
        it('then it should return false', function () {
            var datasource = {
                annotationQuery: jest.fn(),
            };
            expect(runner.canRun(datasource)).toBe(false);
        });
    });
    describe('when run is called with unsupported props', function () {
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, _a, options, executeAnnotationQueryMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        datasource = {
                            annotationQuery: jest.fn(),
                        };
                        _a = getTestContext(), options = _a.options, executeAnnotationQueryMock = _a.executeAnnotationQueryMock;
                        return [4 /*yield*/, expect(runner.run(__assign(__assign({}, options), { datasource: datasource }))).toEmitValuesWith(function (received) {
                                expect(received).toHaveLength(1);
                                var results = received[0];
                                expect(results).toEqual([]);
                                expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(0);
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when run is called and the request is successful', function () {
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, options, executeAnnotationQueryMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext(), options = _a.options, executeAnnotationQueryMock = _a.executeAnnotationQueryMock;
                        return [4 /*yield*/, expect(runner.run(options)).toEmitValuesWith(function (received) {
                                expect(received).toHaveLength(1);
                                var results = received[0];
                                expect(results).toEqual([{ id: '1' }]);
                                expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        describe('but result is missing events prop', function () {
            it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, options, executeAnnotationQueryMock;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = getTestContext(of({ id: '1' })), options = _a.options, executeAnnotationQueryMock = _a.executeAnnotationQueryMock;
                            return [4 /*yield*/, expect(runner.run(options)).toEmitValuesWith(function (received) {
                                    expect(received).toHaveLength(1);
                                    var results = received[0];
                                    expect(results).toEqual([]);
                                    expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                                })];
                        case 1:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('when run is called and the request fails', function () {
        silenceConsoleOutput();
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, options, executeAnnotationQueryMock, dispatchMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext(throwError({ message: 'An error' })), options = _a.options, executeAnnotationQueryMock = _a.executeAnnotationQueryMock, dispatchMock = _a.dispatchMock;
                        return [4 /*yield*/, expect(runner.run(options)).toEmitValuesWith(function (received) {
                                expect(received).toHaveLength(1);
                                var results = received[0];
                                expect(results).toEqual([]);
                                expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                                expect(dispatchMock).toHaveBeenCalledTimes(1);
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when run is called and the request is cancelled', function () {
        silenceConsoleOutput();
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, options, executeAnnotationQueryMock, dispatchMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext(throwError({ cancelled: true })), options = _a.options, executeAnnotationQueryMock = _a.executeAnnotationQueryMock, dispatchMock = _a.dispatchMock;
                        return [4 /*yield*/, expect(runner.run(options)).toEmitValuesWith(function (received) {
                                expect(received).toHaveLength(1);
                                var results = received[0];
                                expect(results).toEqual([]);
                                expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                                expect(dispatchMock).not.toHaveBeenCalled();
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=AnnotationsQueryRunner.test.js.map