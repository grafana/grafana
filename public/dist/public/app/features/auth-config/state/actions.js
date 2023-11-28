import { __awaiter } from "tslib";
import { lastValueFrom } from 'rxjs';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
import { getAuthProviderStatus, getRegisteredAuthProviders } from '..';
import { loadingBegin, loadingEnd, providerStatusesLoaded, resetError, setError, settingsUpdated } from './reducers';
export function loadSettings() {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        if (contextSrv.hasPermission(AccessControlAction.SettingsRead)) {
            dispatch(loadingBegin());
            const result = yield getBackendSrv().get('/api/admin/settings');
            dispatch(settingsUpdated(result));
            yield dispatch(loadProviderStatuses());
            dispatch(loadingEnd());
            return result;
        }
    });
}
export function loadProviderStatuses() {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const registeredProviders = getRegisteredAuthProviders();
        const providerStatuses = {};
        const getStatusPromises = [];
        for (const provider of registeredProviders) {
            getStatusPromises.push(getAuthProviderStatus(provider.id));
        }
        const statuses = yield Promise.all(getStatusPromises);
        for (let i = 0; i < registeredProviders.length; i++) {
            const provider = registeredProviders[i];
            const status = statuses[i];
            providerStatuses[provider.id] = status;
        }
        dispatch(providerStatusesLoaded(providerStatuses));
    });
}
export function saveSettings(data) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (contextSrv.hasPermission(AccessControlAction.SettingsWrite)) {
            try {
                yield lastValueFrom(getBackendSrv().fetch({
                    url: '/api/admin/settings',
                    method: 'PUT',
                    data,
                    showSuccessAlert: false,
                    showErrorAlert: false,
                }));
                dispatch(resetError());
                return true;
            }
            catch (error) {
                console.log(error);
                if (isFetchError(error)) {
                    error.isHandled = true;
                    const updateErr = {
                        message: (_a = error.data) === null || _a === void 0 ? void 0 : _a.message,
                        errors: (_b = error.data) === null || _b === void 0 ? void 0 : _b.errors,
                    };
                    dispatch(setError(updateErr));
                    return false;
                }
            }
        }
        return false;
    });
}
//# sourceMappingURL=actions.js.map