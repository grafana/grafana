import { __awaiter } from "tslib";
import { getBackendSrv, locationService } from '@grafana/runtime';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { serviceAccountFetchBegin, serviceAccountFetchEnd, serviceAccountLoaded, serviceAccountTokensLoaded, } from './reducers';
const BASE_URL = `/api/serviceaccounts`;
export function loadServiceAccount(saID) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        dispatch(serviceAccountFetchBegin());
        try {
            const response = yield getBackendSrv().get(`${BASE_URL}/${saID}`, accessControlQueryParam());
            dispatch(serviceAccountLoaded(response));
        }
        catch (error) {
            console.error(error);
        }
        finally {
            dispatch(serviceAccountFetchEnd());
        }
    });
}
export function updateServiceAccount(serviceAccount) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().patch(`${BASE_URL}/${serviceAccount.id}?accesscontrol=true`, Object.assign({}, serviceAccount));
        dispatch(loadServiceAccount(serviceAccount.id));
    });
}
export function deleteServiceAccount(serviceAccountId) {
    return () => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().delete(`${BASE_URL}/${serviceAccountId}`);
        locationService.push('/org/serviceaccounts');
    });
}
export function createServiceAccountToken(saID, token, onTokenCreated) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const result = yield getBackendSrv().post(`${BASE_URL}/${saID}/tokens`, token);
        onTokenCreated(result.key);
        dispatch(loadServiceAccountTokens(saID));
    });
}
export function deleteServiceAccountToken(saID, id) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().delete(`${BASE_URL}/${saID}/tokens/${id}`);
        dispatch(loadServiceAccountTokens(saID));
    });
}
export function loadServiceAccountTokens(saID) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield getBackendSrv().get(`${BASE_URL}/${saID}/tokens`);
            dispatch(serviceAccountTokensLoaded(response));
        }
        catch (error) {
            console.error(error);
        }
    });
}
//# sourceMappingURL=actionsServiceAccountPage.js.map