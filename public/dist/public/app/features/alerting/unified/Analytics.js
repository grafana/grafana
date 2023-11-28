import { __awaiter } from "tslib";
import { dateTime } from '@grafana/data';
import { faro, LogLevel as GrafanaLogLevel } from '@grafana/faro-web-sdk';
import { getBackendSrv, logError } from '@grafana/runtime';
import { config, reportInteraction } from '@grafana/runtime/src';
import { contextSrv } from 'app/core/core';
export const USER_CREATION_MIN_DAYS = 7;
export const LogMessages = {
    filterByLabel: 'filtering alert instances by label',
    loadedList: 'loaded Alert Rules list',
    leavingRuleGroupEdit: 'leaving rule group edit without saving',
    alertRuleFromPanel: 'creating alert rule from panel',
    alertRuleFromScratch: 'creating alert rule from scratch',
    recordingRuleFromScratch: 'creating recording rule from scratch',
    clickingAlertStateFilters: 'clicking alert state filters',
    cancelSavingAlertRule: 'user canceled alert rule creation',
    successSavingAlertRule: 'alert rule saved successfully',
    unknownMessageFromError: 'unknown messageFromError',
};
// logInfo from '@grafana/runtime' should be used, but it doesn't handle Grafana JS Agent correctly
export function logInfo(message, context = {}) {
    if (config.grafanaJavascriptAgent.enabled) {
        faro.api.pushLog([message], {
            level: GrafanaLogLevel.INFO,
            context: Object.assign(Object.assign({}, context), { module: 'Alerting' }),
        });
    }
}
export function logAlertingError(error, context = {}) {
    logError(error, Object.assign(Object.assign({}, context), { module: 'Alerting' }));
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withPerformanceLogging(func, message, context) {
    return function (...args) {
        return __awaiter(this, void 0, void 0, function* () {
            const startLoadingTs = performance.now();
            const response = yield func(...args);
            logInfo(message, Object.assign({ loadTimeMs: (performance.now() - startLoadingTs).toFixed(0) }, context));
            return response;
        });
    };
}
export function isNewUser() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { createdAt } = yield getBackendSrv().get(`/api/user`);
            const limitDateForNewUser = dateTime().subtract(USER_CREATION_MIN_DAYS, 'days');
            const userCreationDate = dateTime(createdAt);
            const isNew = limitDateForNewUser.isBefore(userCreationDate);
            return isNew;
        }
        catch (_a) {
            return true; //if no date is returned, we assume the user is new to prevent tracking actions
        }
    });
}
export const trackRuleListNavigation = (props = {
    grafana_version: config.buildInfo.version,
    org_id: contextSrv.user.orgId,
    user_id: contextSrv.user.id,
}) => __awaiter(void 0, void 0, void 0, function* () {
    const isNew = yield isNewUser();
    if (isNew) {
        return;
    }
    reportInteraction('grafana_alerting_navigation', props);
});
export const trackNewAlerRuleFormSaved = (props) => __awaiter(void 0, void 0, void 0, function* () {
    const isNew = yield isNewUser();
    if (isNew) {
        return;
    }
    reportInteraction('grafana_alerting_rule_creation', props);
});
export const trackNewAlerRuleFormCancelled = (props) => __awaiter(void 0, void 0, void 0, function* () {
    const isNew = yield isNewUser();
    if (isNew) {
        return;
    }
    reportInteraction('grafana_alerting_rule_aborted', props);
});
export const trackNewAlerRuleFormError = (props) => __awaiter(void 0, void 0, void 0, function* () {
    const isNew = yield isNewUser();
    if (isNew) {
        return;
    }
    reportInteraction('grafana_alerting_rule_form_error', props);
});
export const trackInsightsFeedback = (props) => __awaiter(void 0, void 0, void 0, function* () {
    const defaults = {
        grafana_version: config.buildInfo.version,
        org_id: contextSrv.user.orgId,
        user_id: contextSrv.user.id,
    };
    reportInteraction('grafana_alerting_insights', Object.assign(Object.assign({}, defaults), props));
});
//# sourceMappingURL=Analytics.js.map