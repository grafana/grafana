import { __assign, __awaiter, __generator } from "tslib";
import { AlertState, getDefaultTimeRange } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import { UnifiedAlertStatesWorker } from './UnifiedAlertStatesWorker';
import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
import * as store from '../../../../store/store';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
import { lastValueFrom } from 'rxjs';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; } })); });
function getDefaultOptions() {
    var dashboard = { id: 'an id', uid: 'a uid' };
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
describe('UnifiedAlertStatesWorker', function () {
    var worker = new UnifiedAlertStatesWorker();
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
    describe('when run repeatedly for the same dashboard and no alert rules are found', function () {
        it('then canWork should start returning false', function () { return __awaiter(void 0, void 0, void 0, function () {
            var worker, getResults, _a, getMock, options;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        worker = new UnifiedAlertStatesWorker();
                        getResults = {
                            status: 'success',
                            data: {
                                groups: [],
                            },
                        };
                        _a = getTestContext(), getMock = _a.getMock, options = _a.options;
                        getMock.mockResolvedValue(getResults);
                        expect(worker.canWork(options)).toBe(true);
                        return [4 /*yield*/, lastValueFrom(worker.work(options))];
                    case 1:
                        _b.sent();
                        expect(worker.canWork(options)).toBe(false);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when run is called with correct props and request is successful', function () {
        function mockPromRuleDTO(overrides) {
            return __assign({ alerts: [], health: 'ok', name: 'foo', query: 'foo', type: PromRuleType.Alerting, state: PromAlertingRuleState.Firing, labels: {}, annotations: {} }, overrides);
        }
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var getResults, _a, getMock, options;
            var _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        getResults = {
                            status: 'success',
                            data: {
                                groups: [
                                    {
                                        name: 'group',
                                        file: '',
                                        interval: 1,
                                        rules: [
                                            mockPromRuleDTO({
                                                state: PromAlertingRuleState.Firing,
                                                annotations: (_b = {},
                                                    _b[Annotation.dashboardUID] = 'a uid',
                                                    _b[Annotation.panelID] = '1',
                                                    _b),
                                            }),
                                            mockPromRuleDTO({
                                                state: PromAlertingRuleState.Inactive,
                                                annotations: (_c = {},
                                                    _c[Annotation.dashboardUID] = 'a uid',
                                                    _c[Annotation.panelID] = '2',
                                                    _c),
                                            }),
                                            mockPromRuleDTO({
                                                state: PromAlertingRuleState.Pending,
                                                annotations: (_d = {},
                                                    _d[Annotation.dashboardUID] = 'a uid',
                                                    _d[Annotation.panelID] = '2',
                                                    _d),
                                            }),
                                        ],
                                    },
                                ],
                            },
                        };
                        _a = getTestContext(), getMock = _a.getMock, options = _a.options;
                        getMock.mockResolvedValue(getResults);
                        return [4 /*yield*/, expect(worker.work(options)).toEmitValuesWith(function (received) {
                                expect(received).toHaveLength(1);
                                var results = received[0];
                                expect(results).toEqual({
                                    alertStates: [
                                        { id: 0, state: AlertState.Alerting, dashboardId: 'an id', panelId: 1 },
                                        { id: 1, state: AlertState.Pending, dashboardId: 'an id', panelId: 2 },
                                    ],
                                    annotations: [],
                                });
                            })];
                    case 1:
                        _e.sent();
                        expect(getMock).toHaveBeenCalledTimes(1);
                        expect(getMock).toHaveBeenCalledWith('/api/prometheus/grafana/api/v1/rules', { dashboard_uid: 'a uid' }, 'dashboard-query-runner-unified-alert-states-an id');
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
//# sourceMappingURL=UnifiedAlertStatesWorker.test.js.map