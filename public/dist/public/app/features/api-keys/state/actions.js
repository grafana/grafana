import { __awaiter } from "tslib";
import { getBackendSrv } from 'app/core/services/backend_srv';
import { apiKeysLoaded, includeExpiredToggled, isFetching, setMigrationResult } from './reducers';
export function loadApiKeys() {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        dispatch(isFetching());
        const [keys, keysIncludingExpired] = yield Promise.all([
            getBackendSrv().get('/api/auth/keys?includeExpired=false&accesscontrol=true'),
            getBackendSrv().get('/api/auth/keys?includeExpired=true&accesscontrol=true'),
        ]);
        dispatch(apiKeysLoaded({ keys, keysIncludingExpired }));
    });
}
export function deleteApiKey(id) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        getBackendSrv()
            .delete(`/api/auth/keys/${id}`)
            .then(() => dispatch(loadApiKeys()));
    });
}
export function migrateApiKey(id) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        try {
            yield getBackendSrv().post(`/api/serviceaccounts/migrate/${id}`);
        }
        finally {
            dispatch(loadApiKeys());
        }
    });
}
export function migrateAll() {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        try {
            const payload = yield getBackendSrv().post('/api/serviceaccounts/migrate');
            dispatch(setMigrationResult(payload));
        }
        finally {
            dispatch(loadApiKeys());
        }
    });
}
export function toggleIncludeExpired() {
    return (dispatch) => {
        dispatch(includeExpiredToggled());
    };
}
//# sourceMappingURL=actions.js.map