import { __awaiter } from "tslib";
import { getBackendSrv } from '@grafana/runtime';
import { updateConfigurationSubtitle } from 'app/core/actions';
import { organizationLoaded, userOrganizationsLoaded } from './reducers';
export function loadOrganization(dependencies = { getBackendSrv: getBackendSrv }) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const organizationResponse = yield dependencies.getBackendSrv().get('/api/org');
        dispatch(organizationLoaded(organizationResponse));
        return organizationResponse;
    });
}
export function updateOrganization(dependencies = { getBackendSrv: getBackendSrv }) {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        const organization = getStore().organization.organization;
        yield dependencies.getBackendSrv().put('/api/org', { name: organization.name });
        dispatch(updateConfigurationSubtitle(organization.name));
        dispatch(loadOrganization(dependencies));
    });
}
export function setUserOrganization(orgId, dependencies = { getBackendSrv: getBackendSrv }) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const organizationResponse = yield dependencies.getBackendSrv().post('/api/user/using/' + orgId);
        dispatch(updateConfigurationSubtitle(organizationResponse.name));
    });
}
export function createOrganization(newOrg, dependencies = { getBackendSrv: getBackendSrv }) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const result = yield dependencies.getBackendSrv().post('/api/orgs/', newOrg);
        dispatch(setUserOrganization(result.orgId));
    });
}
export function getUserOrganizations(dependencies = { getBackendSrv: getBackendSrv }) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const result = yield dependencies.getBackendSrv().get('/api/user/orgs');
        dispatch(userOrganizationsLoaded(result));
        return result;
    });
}
//# sourceMappingURL=actions.js.map