import { __awaiter } from "tslib";
import { api } from '../../helpers/api';
const BASE_URL = `/v1/management/Advisors`;
export const AdvisorsService = {
    list(token, disableNotifications) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post(`${BASE_URL}/List`, undefined, disableNotifications, token);
        });
    },
};
//# sourceMappingURL=Advisors.service.js.map