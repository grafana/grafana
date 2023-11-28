import { __awaiter } from "tslib";
import { lastValueFrom } from 'rxjs';
import { AlertState, getDefaultTimeRange } from '@grafana/data';
import { config } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
import { createDashboardModelFixture } from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';
import { AccessControlAction } from 'app/types/accessControl';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';
import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
import * as store from '../../../../store/store';
import { UnifiedAlertStatesWorker } from './UnifiedAlertStatesWorker';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => backendSrv })));
function getDefaultOptions() {
    const dashboard = createDashboardModelFixture({
        id: 12345,
        uid: 'a uid',
    }, {});
    const range = getDefaultTimeRange();
    return { dashboard, range };
}
function getTestContext() {
    jest.clearAllMocks();
    const dispatchMock = jest.spyOn(store, 'dispatch');
    const options = getDefaultOptions();
    const getMock = jest.spyOn(backendSrv, 'get');
    return { getMock, options, dispatchMock };
}
describe('UnifiedAlertStatesWorker', () => {
    const worker = new UnifiedAlertStatesWorker();
    beforeEach(() => {
        config.publicDashboardAccessToken = '';
        grantUserPermissions(Object.values(AccessControlAction));
    });
    describe('when canWork is called with correct props', () => {
        it('then it should return true', () => {
            const options = getDefaultOptions();
            expect(worker.canWork(options)).toBe(true);
        });
    });
    describe('when canWork is called on a public dashboard view', () => {
        it('then it should return false', () => {
            const options = getDefaultOptions();
            config.publicDashboardAccessToken = 'abc123';
            expect(worker.canWork(options)).toBe(false);
        });
    });
    describe('when canWork is called with no dashboard id', () => {
        it('then it should return false', () => {
            const dashboard = createDashboardModelFixture({});
            const options = Object.assign(Object.assign({}, getDefaultOptions()), { dashboard });
            expect(worker.canWork(options)).toBe(false);
        });
    });
    describe('when canWork is called with wrong range', () => {
        it('then it should return false', () => {
            const defaultRange = getDefaultTimeRange();
            const range = Object.assign(Object.assign({}, defaultRange), { raw: Object.assign(Object.assign({}, defaultRange.raw), { to: 'now-6h' }) });
            const options = Object.assign(Object.assign({}, getDefaultOptions()), { range });
            expect(worker.canWork(options)).toBe(false);
        });
    });
    describe('when run is called with incorrect props', () => {
        it('then it should return the correct results', () => __awaiter(void 0, void 0, void 0, function* () {
            const { getMock, options } = getTestContext();
            const dashboard = createDashboardModelFixture({});
            yield expect(worker.work(Object.assign(Object.assign({}, options), { dashboard }))).toEmitValuesWith((received) => {
                expect(received).toHaveLength(1);
                const results = received[0];
                expect(results).toEqual({ alertStates: [], annotations: [] });
                expect(getMock).not.toHaveBeenCalled();
            });
        }));
    });
    describe('when run repeatedly for the same dashboard and no alert rules are found', () => {
        it('then canWork should start returning false', () => __awaiter(void 0, void 0, void 0, function* () {
            const worker = new UnifiedAlertStatesWorker();
            const getResults = {
                status: 'success',
                data: {
                    groups: [],
                },
            };
            const { getMock, options } = getTestContext();
            getMock.mockResolvedValue(getResults);
            expect(worker.canWork(options)).toBe(true);
            yield lastValueFrom(worker.work(options));
            expect(worker.canWork(options)).toBe(false);
        }));
    });
    describe('when run is called with correct props and request is successful', () => {
        function mockPromRuleDTO(overrides) {
            return Object.assign({ alerts: [], health: 'ok', name: 'foo', query: 'foo', type: PromRuleType.Alerting, state: PromAlertingRuleState.Firing, labels: {}, annotations: {} }, overrides);
        }
        it('then it should return the correct results', () => __awaiter(void 0, void 0, void 0, function* () {
            const getResults = {
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
                                    annotations: {
                                        [Annotation.dashboardUID]: 'a uid',
                                        [Annotation.panelID]: '1',
                                    },
                                }),
                                mockPromRuleDTO({
                                    state: PromAlertingRuleState.Inactive,
                                    annotations: {
                                        [Annotation.dashboardUID]: 'a uid',
                                        [Annotation.panelID]: '2',
                                    },
                                }),
                                mockPromRuleDTO({
                                    state: PromAlertingRuleState.Pending,
                                    annotations: {
                                        [Annotation.dashboardUID]: 'a uid',
                                        [Annotation.panelID]: '2',
                                    },
                                }),
                            ],
                        },
                    ],
                },
            };
            const { getMock, options } = getTestContext();
            getMock.mockResolvedValue(getResults);
            yield expect(worker.work(options)).toEmitValuesWith((received) => {
                expect(received).toHaveLength(1);
                const results = received[0];
                expect(results).toEqual({
                    alertStates: [
                        { id: 0, state: AlertState.Alerting, dashboardId: 12345, panelId: 1 },
                        { id: 1, state: AlertState.Pending, dashboardId: 12345, panelId: 2 },
                    ],
                    annotations: [],
                });
            });
            expect(getMock).toHaveBeenCalledTimes(1);
            expect(getMock).toHaveBeenCalledWith('/api/prometheus/grafana/api/v1/rules', { dashboard_uid: 'a uid' }, 'dashboard-query-runner-unified-alert-states-12345');
        }));
    });
    describe('when run is called with correct props and request fails', () => {
        silenceConsoleOutput();
        it('then it should return the correct results', () => __awaiter(void 0, void 0, void 0, function* () {
            const { getMock, options, dispatchMock } = getTestContext();
            getMock.mockRejectedValue({ message: 'An error' });
            yield expect(worker.work(options)).toEmitValuesWith((received) => {
                expect(received).toHaveLength(1);
                const results = received[0];
                expect(results).toEqual({ alertStates: [], annotations: [] });
                expect(getMock).toHaveBeenCalledTimes(1);
                expect(dispatchMock).toHaveBeenCalledTimes(1);
            });
        }));
    });
    describe('when run is called with correct props and request is cancelled', () => {
        silenceConsoleOutput();
        it('then it should return the correct results', () => __awaiter(void 0, void 0, void 0, function* () {
            const { getMock, options, dispatchMock } = getTestContext();
            getMock.mockRejectedValue({ cancelled: true });
            yield expect(worker.work(options)).toEmitValuesWith((received) => {
                expect(received).toHaveLength(1);
                const results = received[0];
                expect(results).toEqual({ alertStates: [], annotations: [] });
                expect(getMock).toHaveBeenCalledTimes(1);
                expect(dispatchMock).not.toHaveBeenCalled();
            });
        }));
    });
});
describe('UnifiedAlertStateWorker with RBAC', () => {
    beforeAll(() => {
        grantUserPermissions([]);
    });
    it('should not do work with insufficient permissions', () => {
        const worker = new UnifiedAlertStatesWorker();
        const options = getDefaultOptions();
        expect(worker.canWork(options)).toBe(false);
    });
    it('should do work with correct permissions', () => {
        grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleExternalRead]);
        const workerWithPermissions = new UnifiedAlertStatesWorker();
        const options = getDefaultOptions();
        expect(workerWithPermissions.canWork(options)).toBe(true);
    });
});
//# sourceMappingURL=UnifiedAlertStatesWorker.test.js.map