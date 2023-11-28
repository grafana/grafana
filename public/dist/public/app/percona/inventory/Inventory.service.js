/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { __awaiter } from "tslib";
import { api } from 'app/percona/shared/helpers/api';
const BASE_URL = `/v1/inventory`;
export const InventoryService = {
    getAgents(serviceId, nodeId, token) {
        return api.post('/v1/management/Agent/List', { service_id: serviceId, node_id: nodeId }, false, token);
    },
    removeAgent(body, token) {
        return api.post(`${BASE_URL}/Agents/Remove`, body, false, token);
    },
    // TODO unify typings and this function with getServices()
    getDbServices(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield api.post(`${BASE_URL}/Services/List`, {}, false, token);
            const result = {};
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            Object.keys(response).forEach((db) => {
                const dbServices = response[db];
                if (dbServices === null || dbServices === void 0 ? void 0 : dbServices.length) {
                    result[db] = dbServices.map(({ service_id, service_name, cluster }) => ({
                        id: service_id,
                        name: service_name,
                        cluster,
                    }));
                }
            });
            return result;
        });
    },
    getNodes(body = {}, token) {
        return api.post(`/v1/management/Node/List`, body, false, token);
    },
    removeNode(body, token) {
        return api.post(`${BASE_URL}/Nodes/Remove`, body, false, token);
    },
    getService(serviceId, token) {
        return api.post(`${BASE_URL}/Services/Get`, { service_id: serviceId }, false, token);
    },
};
//# sourceMappingURL=Inventory.service.js.map