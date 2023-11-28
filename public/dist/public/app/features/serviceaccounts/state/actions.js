import { __awaiter } from "tslib";
import { debounce } from 'lodash';
import { getBackendSrv } from '@grafana/runtime';
import { fetchRoleOptions } from 'app/core/components/RolePicker/api';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, ServiceAccountStateFilter } from 'app/types';
import { acOptionsLoaded, pageChanged, queryChanged, serviceAccountsFetchBegin, serviceAccountsFetched, serviceAccountsFetchEnd, stateFilterChanged, } from './reducers';
const BASE_URL = `/api/serviceaccounts`;
export function fetchACOptions() {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        try {
            if (contextSrv.licensedAccessControlEnabled() && contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
                const options = yield fetchRoleOptions();
                dispatch(acOptionsLoaded(options));
            }
        }
        catch (error) {
            console.error(error);
        }
    });
}
export function fetchServiceAccounts({ withLoadingIndicator } = { withLoadingIndicator: false }) {
    return (dispatch, getState) => __awaiter(this, void 0, void 0, function* () {
        try {
            if (contextSrv.hasPermission(AccessControlAction.ServiceAccountsRead)) {
                if (withLoadingIndicator) {
                    dispatch(serviceAccountsFetchBegin());
                }
                const { perPage, page, query, serviceAccountStateFilter } = getState().serviceAccounts;
                const result = yield getBackendSrv().get(`/api/serviceaccounts/search?perpage=${perPage}&page=${page}&query=${query}${getStateFilter(serviceAccountStateFilter)}&accesscontrol=true`);
                dispatch(serviceAccountsFetched(result));
            }
        }
        catch (error) {
            console.error(error);
        }
        finally {
            dispatch(serviceAccountsFetchEnd());
        }
    });
}
const fetchServiceAccountsWithDebounce = debounce((dispatch) => dispatch(fetchServiceAccounts()), 500, {
    leading: true,
});
export function updateServiceAccount(serviceAccount) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().patch(`${BASE_URL}/${serviceAccount.id}?accesscontrol=true`, Object.assign({}, serviceAccount));
        dispatch(fetchServiceAccounts());
    });
}
export function deleteServiceAccount(serviceAccountId) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().delete(`${BASE_URL}/${serviceAccountId}`);
        dispatch(fetchServiceAccounts());
    });
}
export function createServiceAccountToken(saID, token, onTokenCreated) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const result = yield getBackendSrv().post(`${BASE_URL}/${saID}/tokens`, token);
        onTokenCreated(result.key);
        dispatch(fetchServiceAccounts());
    });
}
// search / filtering of serviceAccounts
const getStateFilter = (value) => {
    switch (value) {
        case ServiceAccountStateFilter.WithExpiredTokens:
            return '&expiredTokens=true';
        case ServiceAccountStateFilter.Disabled:
            return '&disabled=true';
        default:
            return '';
    }
};
export function changeQuery(query) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        dispatch(queryChanged(query));
        fetchServiceAccountsWithDebounce(dispatch);
    });
}
export function changeStateFilter(filter) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        dispatch(stateFilterChanged(filter));
        dispatch(fetchServiceAccounts());
    });
}
export function changePage(page) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        dispatch(pageChanged(page));
        dispatch(fetchServiceAccounts());
    });
}
//# sourceMappingURL=actions.js.map