import { __awaiter } from "tslib";
import { dateTime } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { isNewUser, USER_CREATION_MIN_DAYS } from './Analytics';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: jest.fn().mockReturnValue({
        get: jest.fn(),
    }) })));
describe('isNewUser', function () {
    it('should return true if the user has been created within the last week', () => __awaiter(this, void 0, void 0, function* () {
        const newUser = {
            id: 1,
            createdAt: dateTime().subtract(6, 'days'),
        };
        getBackendSrv().get = jest.fn().mockResolvedValue(newUser);
        const isNew = yield isNewUser();
        expect(isNew).toBe(true);
        expect(getBackendSrv().get).toHaveBeenCalledTimes(1);
        expect(getBackendSrv().get).toHaveBeenCalledWith('/api/user');
    }));
    it('should return false if the user has been created prior to the last two weeks', () => __awaiter(this, void 0, void 0, function* () {
        const oldUser = {
            id: 2,
            createdAt: dateTime().subtract(USER_CREATION_MIN_DAYS, 'days'),
        };
        getBackendSrv().get = jest.fn().mockResolvedValue(oldUser);
        const isNew = yield isNewUser();
        expect(isNew).toBe(false);
        expect(getBackendSrv().get).toHaveBeenCalledTimes(1);
        expect(getBackendSrv().get).toHaveBeenCalledWith('/api/user');
    }));
});
//# sourceMappingURL=Analytics.test.js.map