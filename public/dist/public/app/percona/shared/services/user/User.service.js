import { __awaiter } from "tslib";
import { api } from 'app/percona/shared/helpers/api';
const BASE_URL = '/v1/Platform';
export const UserService = {
    getUserStatus(cancelToken, disableNotifications = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const { is_platform_user } = yield api.post(`${BASE_URL}/UserStatus`, {}, disableNotifications, cancelToken);
            return is_platform_user;
        });
    },
    getUserDetails: () => __awaiter(void 0, void 0, void 0, function* () { return yield api.get('/v1/user', true); }),
    setProductTourCompleted(completed) {
        return __awaiter(this, void 0, void 0, function* () {
            const payload = { product_tour_completed: completed };
            return yield api.put('/v1/user', payload);
        });
    },
    setAlertingTourCompeted(completed) {
        return __awaiter(this, void 0, void 0, function* () {
            const payload = { alerting_tour_completed: completed };
            return yield api.put('/v1/user', payload);
        });
    },
    getUsersList() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield api.post('/v1/user/list', undefined);
        });
    },
};
//# sourceMappingURL=User.service.js.map