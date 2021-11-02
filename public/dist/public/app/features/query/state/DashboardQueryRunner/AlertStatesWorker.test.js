import { __assign, __awaiter, __generator } from "tslib";
import { AlertState, getDefaultTimeRange } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import { AlertStatesWorker } from './AlertStatesWorker';
import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
import * as store from '../../../../store/store';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; } })); });
function getDefaultOptions() {
    var dashboard = { id: 'an id', panels: [{ alert: {} }] };
    var range = getDefaultTimeRange();
    return { dashboard: dashboard, range: range };
}
function getTestContext() {
    jest.clearAllMocks();
    var dispatchMock = jest.spyOn(store, 'dispatch');
    var options = getDefaultOptions();
    var getMock = jest.spyOn(backendSrv, 'get');
    return { getMock: getMock, options: options, dispatchMock: dispatchMock };
}
describe('AlertStatesWorker', function () {
    var worker = new AlertStatesWorker();
    describe('when canWork is called with correct props', function () {
        it('then it should return true', function () {
            var options = getDefaultOptions();
            expect(worker.canWork(options)).toBe(true);
        });
    });
    describe('when canWork is called with no dashboard id', function () {
        it('then it should return false', function () {
            var dashboard = {};
            var options = __assign(__assign({}, getDefaultOptions()), { dashboard: dashboard });
            expect(worker.canWork(options)).toBe(false);
        });
    });
    describe('when canWork is called with wrong range', function () {
        it('then it should return false', function () {
            var defaultRange = getDefaultTimeRange();
            var range = __assign(__assign({}, defaultRange), { raw: __assign(__assign({}, defaultRange.raw), { to: 'now-6h' }) });
            var options = __assign(__assign({}, getDefaultOptions()), { range: range });
            expect(worker.canWork(options)).toBe(false);
        });
    });
    describe('when canWork is called for dashboard with no alert panels', function () {
        it('then it should return false', function () {
            var options = getDefaultOptions();
            options.dashboard.panels.forEach(function (panel) { return delete panel.alert; });
            expect(worker.canWork(options)).toBe(false);
        });
    });
    describe('when run is called with incorrect props', function () {
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, getMock, options, dashboard;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext(), getMock = _a.getMock, options = _a.options;
                        dashboard = {};
                        return [4 /*yield*/, expect(worker.work(__assign(__assign({}, options), { dashboard: dashboard }))).toEmitValuesWith(function (received) {
                                expect(received).toHaveLength(1);
                                var results = received[0];
                                expect(results).toEqual({ alertStates: [], annotations: [] });
                                expect(getMock).not.toHaveBeenCalled();
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when run is called with correct props and request is successful', function () {
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var getResults, _a, getMock, options;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        getResults = [
                            { id: 1, state: AlertState.Alerting, dashboardId: 1, panelId: 1 },
                            { id: 2, state: AlertState.Alerting, dashboardId: 1, panelId: 2 },
                        ];
                        _a = getTestContext(), getMock = _a.getMock, options = _a.options;
                        getMock.mockResolvedValue(getResults);
                        return [4 /*yield*/, expect(worker.work(options)).toEmitValuesWith(function (received) {
                                expect(received).toHaveLength(1);
                                var results = received[0];
                                expect(results).toEqual({ alertStates: getResults, annotations: [] });
                                expect(getMock).toHaveBeenCalledTimes(1);
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when run is called with correct props and request fails', function () {
        silenceConsoleOutput();
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, getMock, options, dispatchMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext(), getMock = _a.getMock, options = _a.options, dispatchMock = _a.dispatchMock;
                        getMock.mockRejectedValue({ message: 'An error' });
                        return [4 /*yield*/, expect(worker.work(options)).toEmitValuesWith(function (received) {
                                expect(received).toHaveLength(1);
                                var results = received[0];
                                expect(results).toEqual({ alertStates: [], annotations: [] });
                                expect(getMock).toHaveBeenCalledTimes(1);
                                expect(dispatchMock).toHaveBeenCalledTimes(1);
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when run is called with correct props and request is cancelled', function () {
        silenceConsoleOutput();
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, getMock, options, dispatchMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext(), getMock = _a.getMock, options = _a.options, dispatchMock = _a.dispatchMock;
                        getMock.mockRejectedValue({ cancelled: true });
                        return [4 /*yield*/, expect(worker.work(options)).toEmitValuesWith(function (received) {
                                expect(received).toHaveLength(1);
                                var results = received[0];
                                expect(results).toEqual({ alertStates: [], annotations: [] });
                                expect(getMock).toHaveBeenCalledTimes(1);
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
//# sourceMappingURL=AlertStatesWorker.test.js.map