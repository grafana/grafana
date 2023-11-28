import { __awaiter } from "tslib";
import { AlertState, getDefaultTimeRange } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
import * as store from '../../../../store/store';
import { AlertStatesWorker } from './AlertStatesWorker';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => backendSrv })));
function getDefaultOptions() {
    const dashboard = { id: 'an id', panels: [{ alert: {} }] };
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
describe('AlertStatesWorker', () => {
    const worker = new AlertStatesWorker();
    describe('when canWork is called with correct props', () => {
        it('then it should return true', () => {
            const options = getDefaultOptions();
            expect(worker.canWork(options)).toBe(true);
        });
    });
    describe('when canWork is called with no dashboard id', () => {
        it('then it should return false', () => {
            const dashboard = {};
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
    describe('when canWork is called for dashboard with no alert panels', () => {
        it('then it should return false', () => {
            const options = getDefaultOptions();
            options.dashboard.panels.forEach((panel) => delete panel.alert);
            expect(worker.canWork(options)).toBe(false);
        });
    });
    describe('when run is called with incorrect props', () => {
        it('then it should return the correct results', () => __awaiter(void 0, void 0, void 0, function* () {
            const { getMock, options } = getTestContext();
            const dashboard = {};
            yield expect(worker.work(Object.assign(Object.assign({}, options), { dashboard }))).toEmitValuesWith((received) => {
                expect(received).toHaveLength(1);
                const results = received[0];
                expect(results).toEqual({ alertStates: [], annotations: [] });
                expect(getMock).not.toHaveBeenCalled();
            });
        }));
    });
    describe('when run is called with correct props and request is successful', () => {
        it('then it should return the correct results', () => __awaiter(void 0, void 0, void 0, function* () {
            const getResults = [
                { id: 1, state: AlertState.Alerting, dashboardId: 1, panelId: 1 },
                { id: 2, state: AlertState.Alerting, dashboardId: 1, panelId: 2 },
            ];
            const { getMock, options } = getTestContext();
            getMock.mockResolvedValue(getResults);
            yield expect(worker.work(options)).toEmitValuesWith((received) => {
                expect(received).toHaveLength(1);
                const results = received[0];
                expect(results).toEqual({ alertStates: getResults, annotations: [] });
                expect(getMock).toHaveBeenCalledTimes(1);
            });
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
//# sourceMappingURL=AlertStatesWorker.test.js.map