import { __awaiter } from "tslib";
import { api } from 'app/percona/shared/helpers/api';
const BASE_URL = `/v1/management/alerting/Templates`;
export const AlertRuleTemplateService = {
    upload(payload, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post(`${BASE_URL}/Create`, payload, false, token);
        });
    },
    list(payload, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post(`${BASE_URL}/List`, Object.assign(Object.assign({}, payload), { reload: true }), true, token).then(({ totals, templates = [] }) => ({
                totals,
                templates: templates.map((template) => {
                    var _a;
                    return (Object.assign(Object.assign({}, template), { params: (_a = template.params) === null || _a === void 0 ? void 0 : _a.map((param) => (Object.assign(Object.assign({}, param), { float: param.float
                                ? {
                                    hasMin: param.float.has_min,
                                    hasDefault: param.float.has_default,
                                    hasMax: param.float.has_max,
                                    min: param.float.min,
                                    max: param.float.max,
                                    default: param.float.default,
                                }
                                : undefined }))) }));
                }),
            }));
        });
    },
    update(payload, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post(`${BASE_URL}/Update`, payload, false, token);
        });
    },
    delete(payload, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post(`${BASE_URL}/Delete`, payload, false, token);
        });
    },
};
//# sourceMappingURL=AlertRuleTemplate.service.js.map