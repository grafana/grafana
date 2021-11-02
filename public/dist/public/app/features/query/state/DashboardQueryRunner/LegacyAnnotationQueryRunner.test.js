import { __assign, __awaiter, __generator } from "tslib";
import { getDefaultTimeRange } from '@grafana/data';
import { LegacyAnnotationQueryRunner } from './LegacyAnnotationQueryRunner';
import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
import * as store from '../../../../store/store';
function getDefaultOptions(annotationQuery) {
    var annotation = {};
    var dashboard = {};
    var datasource = {
        annotationQuery: annotationQuery !== null && annotationQuery !== void 0 ? annotationQuery : jest.fn().mockResolvedValue([{ id: '1' }]),
    };
    var range = getDefaultTimeRange();
    return { annotation: annotation, datasource: datasource, dashboard: dashboard, range: range };
}
function getTestContext(annotationQuery) {
    jest.clearAllMocks();
    var dispatchMock = jest.spyOn(store, 'dispatch');
    var options = getDefaultOptions(annotationQuery);
    var annotationQueryMock = options.datasource.annotationQuery;
    return { options: options, dispatchMock: dispatchMock, annotationQueryMock: annotationQueryMock };
}
describe('LegacyAnnotationQueryRunner', function () {
    var runner = new LegacyAnnotationQueryRunner();
    describe('when canWork is called with correct props', function () {
        it('then it should return true', function () {
            var datasource = {
                annotationQuery: jest.fn(),
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
                annotations: {},
            };
            expect(runner.canRun(datasource)).toBe(false);
        });
    });
    describe('when run is called with unsupported props', function () {
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, options;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = {
                            annotationQuery: jest.fn(),
                            annotations: {},
                        };
                        options = __assign(__assign({}, getDefaultOptions()), { datasource: datasource });
                        return [4 /*yield*/, expect(runner.run(options)).toEmitValuesWith(function (received) {
                                expect(received).toHaveLength(1);
                                var results = received[0];
                                expect(results).toEqual([]);
                                expect(datasource.annotationQuery).not.toHaveBeenCalled();
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when run is called and the request is successful', function () {
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, options, annotationQueryMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext(), options = _a.options, annotationQueryMock = _a.annotationQueryMock;
                        return [4 /*yield*/, expect(runner.run(options)).toEmitValuesWith(function (received) {
                                expect(received).toHaveLength(1);
                                var results = received[0];
                                expect(results).toEqual([{ id: '1' }]);
                                expect(annotationQueryMock).toHaveBeenCalledTimes(1);
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when run is called and the request fails', function () {
        silenceConsoleOutput();
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var annotationQuery, _a, options, annotationQueryMock, dispatchMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        annotationQuery = jest.fn().mockRejectedValue({ message: 'An error' });
                        _a = getTestContext(annotationQuery), options = _a.options, annotationQueryMock = _a.annotationQueryMock, dispatchMock = _a.dispatchMock;
                        return [4 /*yield*/, expect(runner.run(options)).toEmitValuesWith(function (received) {
                                expect(received).toHaveLength(1);
                                var results = received[0];
                                expect(results).toEqual([]);
                                expect(annotationQueryMock).toHaveBeenCalledTimes(1);
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
            var annotationQuery, _a, options, annotationQueryMock, dispatchMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        annotationQuery = jest.fn().mockRejectedValue({ cancelled: true });
                        _a = getTestContext(annotationQuery), options = _a.options, annotationQueryMock = _a.annotationQueryMock, dispatchMock = _a.dispatchMock;
                        return [4 /*yield*/, expect(runner.run(options)).toEmitValuesWith(function (received) {
                                expect(received).toHaveLength(1);
                                var results = received[0];
                                expect(results).toEqual([]);
                                expect(annotationQueryMock).toHaveBeenCalledTimes(1);
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
//# sourceMappingURL=LegacyAnnotationQueryRunner.test.js.map