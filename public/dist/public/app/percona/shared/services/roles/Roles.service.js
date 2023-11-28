import { __awaiter } from "tslib";
import { api } from 'app/percona/shared/helpers/api';
import { toAccessRole, toCreateBody, toUpdateBody } from './Roles.utils';
const BASE_URL = '/v1/management/Role';
const RolesService = {
    get(roleId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield api.post(`${BASE_URL}/Get`, { role_id: roleId });
            return toAccessRole(response);
        });
    },
    list() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield api.post(`${BASE_URL}/List`, undefined);
            return response.roles.map((role) => toAccessRole(role));
        });
    },
    create(role) {
        return __awaiter(this, void 0, void 0, function* () {
            yield api.post(`${BASE_URL}/Create`, toCreateBody(role));
        });
    },
    update(role) {
        return __awaiter(this, void 0, void 0, function* () {
            yield api.post(`${BASE_URL}/Update`, toUpdateBody(role));
        });
    },
    delete(role) {
        return __awaiter(this, void 0, void 0, function* () {
            yield api.post(`${BASE_URL}/Delete`, {
                role_id: role.toDeleteId,
                replacement_role_id: role.replacementRoleId,
            });
        });
    },
    assign(roleIds, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield api.post(`${BASE_URL}/Assign`, {
                role_ids: roleIds,
                user_id: userId,
            });
        });
    },
    setDefault(roleId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield api.post(`${BASE_URL}/SetDefault`, {
                role_id: roleId,
            });
        });
    },
};
export default RolesService;
//# sourceMappingURL=Roles.service.js.map