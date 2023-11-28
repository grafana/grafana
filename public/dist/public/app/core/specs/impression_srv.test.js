import { __awaiter } from "tslib";
const mockBackendSrv = jest.fn();
import impressionSrv from '../services/impression_srv';
jest.mock('@grafana/runtime', () => {
    const originalRuntime = jest.requireActual('@grafana/runtime');
    return Object.assign(Object.assign({}, originalRuntime), { getBackendSrv: mockBackendSrv, config: Object.assign(Object.assign({}, originalRuntime.config), { bootData: Object.assign(Object.assign({}, originalRuntime.config.bootData), { user: Object.assign(Object.assign({}, originalRuntime.config.bootData.user), { orgId: 'testOrgId' }) }) }) });
});
describe('ImpressionSrv', () => {
    beforeEach(() => {
        window.localStorage.removeItem(impressionSrv.impressionKey());
    });
    describe('getDashboardOpened', () => {
        it('should return list of dashboard uids', () => __awaiter(void 0, void 0, void 0, function* () {
            window.localStorage.setItem(impressionSrv.impressionKey(), JSON.stringify(['five', 'four', 1, 2, 3]));
            mockBackendSrv.mockImplementation(() => ({ get: jest.fn().mockResolvedValue(['one', 'two', 'three']) }));
            const result1 = yield impressionSrv.getDashboardOpened();
            expect(result1).toEqual(['five', 'four', 'one', 'two', 'three']);
            window.localStorage.setItem(impressionSrv.impressionKey(), JSON.stringify(['three', 'four']));
            const result2 = yield impressionSrv.getDashboardOpened();
            expect(result2).toEqual(['three', 'four']);
            window.localStorage.setItem(impressionSrv.impressionKey(), JSON.stringify([1, 2, 3]));
            mockBackendSrv.mockImplementation(() => ({ get: jest.fn().mockResolvedValue(['one', 'two', 'three']) }));
            const result3 = yield impressionSrv.getDashboardOpened();
            expect(result3).toEqual(['one', 'two', 'three']);
        }));
    });
});
//# sourceMappingURL=impression_srv.test.js.map