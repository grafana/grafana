import { __awaiter } from "tslib";
import { lastValueFrom } from 'rxjs';
import { urlUtil } from '@grafana/data';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { getDatasourceAPIUid, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
// "grafana" for grafana-managed, otherwise a datasource name
export function fetchAlertManagerConfig(alertManagerSourceName) {
    var _a, _b, _c, _d, _e;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield lastValueFrom(getBackendSrv().fetch({
                url: `/api/alertmanager/${getDatasourceAPIUid(alertManagerSourceName)}/config/api/v1/alerts`,
                showErrorAlert: false,
                showSuccessAlert: false,
            }));
            return {
                template_files: (_a = result.data.template_files) !== null && _a !== void 0 ? _a : {},
                template_file_provenances: (_b = result.data.template_file_provenances) !== null && _b !== void 0 ? _b : {},
                alertmanager_config: (_c = result.data.alertmanager_config) !== null && _c !== void 0 ? _c : {},
                last_applied: result.data.last_applied,
                id: result.data.id,
            };
        }
        catch (e) {
            // if no config has been uploaded to grafana, it returns error instead of latest config
            if (alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME &&
                isFetchError(e) &&
                ((_e = (_d = e.data) === null || _d === void 0 ? void 0 : _d.message) === null || _e === void 0 ? void 0 : _e.includes('could not find an Alertmanager configuration'))) {
                return {
                    template_files: {},
                    alertmanager_config: {},
                };
            }
            throw e;
        }
    });
}
export function updateAlertManagerConfig(alertManagerSourceName, config) {
    return __awaiter(this, void 0, void 0, function* () {
        yield lastValueFrom(getBackendSrv().fetch({
            method: 'POST',
            url: `/api/alertmanager/${getDatasourceAPIUid(alertManagerSourceName)}/config/api/v1/alerts`,
            data: config,
            showErrorAlert: false,
            showSuccessAlert: false,
        }));
    });
}
export function deleteAlertManagerConfig(alertManagerSourceName) {
    return __awaiter(this, void 0, void 0, function* () {
        yield lastValueFrom(getBackendSrv().fetch({
            method: 'DELETE',
            url: `/api/alertmanager/${getDatasourceAPIUid(alertManagerSourceName)}/config/api/v1/alerts`,
            showErrorAlert: false,
            showSuccessAlert: false,
        }));
    });
}
export function fetchSilences(alertManagerSourceName) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield lastValueFrom(getBackendSrv().fetch({
            url: `/api/alertmanager/${getDatasourceAPIUid(alertManagerSourceName)}/api/v2/silences`,
            showErrorAlert: false,
            showSuccessAlert: false,
        }));
        return result.data;
    });
}
// returns the new silence ID. Even in the case of an update, a new silence is created and the previous one expired.
export function createOrUpdateSilence(alertmanagerSourceName, payload) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield lastValueFrom(getBackendSrv().fetch({
            url: `/api/alertmanager/${getDatasourceAPIUid(alertmanagerSourceName)}/api/v2/silences`,
            data: payload,
            showErrorAlert: false,
            showSuccessAlert: false,
            method: 'POST',
        }));
        return result.data;
    });
}
export function expireSilence(alertmanagerSourceName, silenceID) {
    return __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().delete(`/api/alertmanager/${getDatasourceAPIUid(alertmanagerSourceName)}/api/v2/silence/${encodeURIComponent(silenceID)}`);
    });
}
export function fetchAlerts(alertmanagerSourceName, matchers, silenced = true, active = true, inhibited = true) {
    return __awaiter(this, void 0, void 0, function* () {
        const filters = urlUtil.toUrlParams({ silenced, active, inhibited }) +
            (matchers === null || matchers === void 0 ? void 0 : matchers.map((matcher) => `filter=${encodeURIComponent(`${escapeQuotes(matcher.name)}=${matcher.isRegex ? '~' : ''}"${escapeQuotes(matcher.value)}"`)}`).join('&')) || '';
        const result = yield lastValueFrom(getBackendSrv().fetch({
            url: `/api/alertmanager/${getDatasourceAPIUid(alertmanagerSourceName)}/api/v2/alerts` +
                (filters ? '?' + filters : ''),
            showErrorAlert: false,
            showSuccessAlert: false,
        }));
        return result.data;
    });
}
export function fetchAlertGroups(alertmanagerSourceName) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield lastValueFrom(getBackendSrv().fetch({
            url: `/api/alertmanager/${getDatasourceAPIUid(alertmanagerSourceName)}/api/v2/alerts/groups`,
            showErrorAlert: false,
            showSuccessAlert: false,
        }));
        return result.data;
    });
}
export function fetchStatus(alertManagerSourceName) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield lastValueFrom(getBackendSrv().fetch({
            url: `/api/alertmanager/${getDatasourceAPIUid(alertManagerSourceName)}/api/v2/status`,
            showErrorAlert: false,
            showSuccessAlert: false,
        }));
        return result.data;
    });
}
export function testReceivers(alertManagerSourceName, receivers, alert) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = {
            receivers,
            alert,
        };
        try {
            const result = yield lastValueFrom(getBackendSrv().fetch({
                method: 'POST',
                data,
                url: `/api/alertmanager/${getDatasourceAPIUid(alertManagerSourceName)}/config/api/v1/receivers/test`,
                showErrorAlert: false,
                showSuccessAlert: false,
            }));
            if (receiversResponseContainsErrors(result.data)) {
                throw new Error(getReceiverResultError(result.data));
            }
        }
        catch (error) {
            if (isFetchError(error) && isTestReceiversResult(error.data) && receiversResponseContainsErrors(error.data)) {
                throw new Error(getReceiverResultError(error.data));
            }
            throw error;
        }
    });
}
function receiversResponseContainsErrors(result) {
    return result.receivers.some((receiver) => receiver.grafana_managed_receiver_configs.some((config) => config.status === 'failed'));
}
function isTestReceiversResult(data) {
    const receivers = data === null || data === void 0 ? void 0 : data.receivers;
    if (Array.isArray(receivers)) {
        return receivers.every((receiver) => typeof receiver.name === 'string' && Array.isArray(receiver.grafana_managed_receiver_configs));
    }
    return false;
}
function getReceiverResultError(receiversResult) {
    return receiversResult.receivers
        .flatMap((receiver) => receiver.grafana_managed_receiver_configs
        .filter((receiver) => receiver.status === 'failed')
        .map((receiver) => { var _a; return (_a = receiver.error) !== null && _a !== void 0 ? _a : 'Unknown error.'; }))
        .join('; ');
}
export function addAlertManagers(alertManagerConfig) {
    return __awaiter(this, void 0, void 0, function* () {
        yield lastValueFrom(getBackendSrv().fetch({
            method: 'POST',
            data: alertManagerConfig,
            url: '/api/v1/ngalert/admin_config',
            showErrorAlert: false,
            showSuccessAlert: false,
        })).then(() => {
            fetchExternalAlertmanagerConfig();
        });
    });
}
export function fetchExternalAlertmanagers() {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield lastValueFrom(getBackendSrv().fetch({
            method: 'GET',
            url: '/api/v1/ngalert/alertmanagers',
        }));
        return result.data;
    });
}
export function fetchExternalAlertmanagerConfig() {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield lastValueFrom(getBackendSrv().fetch({
            method: 'GET',
            url: '/api/v1/ngalert/admin_config',
            showErrorAlert: false,
        }));
        return result.data;
    });
}
function escapeQuotes(value) {
    return value.replace(/"/g, '\\"');
}
//# sourceMappingURL=alertmanager.js.map