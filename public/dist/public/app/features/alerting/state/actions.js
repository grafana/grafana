import { __awaiter } from "tslib";
import { getBackendSrv, isFetchError, locationService } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { loadAlertRules, loadedAlertRules, notificationChannelLoaded, setNotificationChannels } from './reducers';
export function getAlertRulesAsync(options) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        dispatch(loadAlertRules());
        const rules = yield getBackendSrv().get('/api/alerts', options);
        dispatch(loadedAlertRules(rules));
    });
}
export function togglePauseAlertRule(id, options) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().post(`/api/alerts/${id}/pause`, options);
        const stateFilter = locationService.getSearchObject().state || 'all';
        dispatch(getAlertRulesAsync({ state: stateFilter.toString() }));
    });
}
export function createNotificationChannel(data) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        try {
            yield getBackendSrv().post(`/api/alert-notifications`, data);
            dispatch(notifyApp(createSuccessNotification('Notification created')));
            locationService.push('/alerting/notifications');
        }
        catch (error) {
            if (isFetchError(error)) {
                dispatch(notifyApp(createErrorNotification(error.data.error)));
            }
        }
    });
}
export function updateNotificationChannel(data) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        try {
            yield getBackendSrv().put(`/api/alert-notifications/${data.id}`, data);
            dispatch(notifyApp(createSuccessNotification('Notification updated')));
        }
        catch (error) {
            if (isFetchError(error)) {
                dispatch(notifyApp(createErrorNotification(error.data.error)));
            }
        }
    });
}
export function testNotificationChannel(data) {
    return (dispatch, getState) => __awaiter(this, void 0, void 0, function* () {
        const channel = getState().notificationChannel.notificationChannel;
        yield getBackendSrv().post('/api/alert-notifications/test', Object.assign({ id: channel.id }, data));
    });
}
export function loadNotificationTypes() {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const alertNotifiers = yield getBackendSrv().get(`/api/alert-notifiers`);
        const notificationTypes = alertNotifiers.sort((o1, o2) => {
            if (o1.name > o2.name) {
                return 1;
            }
            return -1;
        });
        dispatch(setNotificationChannels(notificationTypes));
    });
}
export function loadNotificationChannel(id) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield dispatch(loadNotificationTypes());
        const notificationChannel = yield getBackendSrv().get(`/api/alert-notifications/${id}`);
        dispatch(notificationChannelLoaded(notificationChannel));
    });
}
//# sourceMappingURL=actions.js.map