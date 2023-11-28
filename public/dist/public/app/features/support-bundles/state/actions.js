import { __awaiter } from "tslib";
import { throttle } from 'lodash';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { collectorsFetchBegin, collectorsFetchEnd, fetchBegin, fetchEnd, setCreateBundleError, setLoadBundleError, supportBundleCollectorsLoaded, supportBundlesLoaded, } from './reducers';
export function loadBundles(skipPageRefresh = false) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        try {
            if (!skipPageRefresh) {
                dispatch(fetchBegin());
            }
            const result = yield getBackendSrv().get('/api/support-bundles');
            dispatch(supportBundlesLoaded(result));
        }
        finally {
            dispatch(fetchEnd());
        }
    });
}
const checkBundlesStatusThrottled = throttle((dispatch) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield getBackendSrv().get('/api/support-bundles');
    dispatch(supportBundlesLoaded(result));
}), 1000);
export function checkBundles() {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        dispatch(checkBundlesStatusThrottled);
    });
}
export function removeBundle(uid) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().delete(`/api/support-bundles/${uid}`);
        dispatch(loadBundles(true));
    });
}
export function loadSupportBundleCollectors() {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        try {
            dispatch(collectorsFetchBegin());
            const result = yield getBackendSrv().get('/api/support-bundles/collectors');
            dispatch(supportBundleCollectorsLoaded(result));
        }
        catch (err) {
            dispatch(setLoadBundleError('Error loading support bundles data collectors'));
        }
        finally {
            dispatch(collectorsFetchEnd());
        }
    });
}
export function createSupportBundle(data) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        try {
            yield getBackendSrv().post('/api/support-bundles', data);
            locationService.push('/support-bundles');
        }
        catch (err) {
            dispatch(setCreateBundleError('Error creating support bundle'));
        }
    });
}
//# sourceMappingURL=actions.js.map