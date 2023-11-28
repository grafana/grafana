import { __awaiter } from "tslib";
import { api } from 'app/percona/shared/helpers/api';
const BASE_URL = `/v1/management/alerting/Rules`;
export const AlertRulesService = {
    create(payload, token, disableNotifications) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post(`${BASE_URL}/Create`, payload, disableNotifications, token).catch((e) => {
                var _a, _b, _c;
                // this call is made within Grafana's code, where they expect this format to properly
                // show the error on the toast
                const fetchErr = {
                    status: ((_a = e.response) === null || _a === void 0 ? void 0 : _a.status) || 400,
                    data: (_b = e.response) === null || _b === void 0 ? void 0 : _b.data,
                    config: {
                        url: ((_c = e.config) === null || _c === void 0 ? void 0 : _c.url) || '',
                    },
                };
                throw fetchErr;
            });
        });
    },
};
//# sourceMappingURL=AlertRules.service.js.map