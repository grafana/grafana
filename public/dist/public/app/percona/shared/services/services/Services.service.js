import { api } from 'app/percona/shared/helpers/api';
export const ServicesService = {
    getActive(token, disableNotifications) {
        return api.post('/v1/inventory/Services/ListTypes', {}, disableNotifications, token);
    },
    getServices(body = {}, token) {
        return api.post('/v1/management/Service/List', body, false, token);
    },
    removeService(body, token) {
        return api.post('/v1/inventory/Services/Remove', body, false, token);
    },
    updateService(body, token) {
        return api.post('/v1/inventory/Services/Change', body, false, token);
    },
    addCustomLabels(body, token) {
        return api.post('/v1/inventory/Services/CustomLabels/Add', body, false, token);
    },
    removeCustomLabels(body, token) {
        return api.post('/v1/inventory/Services/CustomLabels/Remove', body, false, token);
    },
};
//# sourceMappingURL=Services.service.js.map