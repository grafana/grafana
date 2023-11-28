import { t } from 'i18next';
import { getBackendSrv } from '@grafana/runtime';
import { validationSrv } from '../services/ValidationSrv';
export const validateDashboardJson = (json) => {
    let dashboard;
    try {
        dashboard = JSON.parse(json);
    }
    catch (error) {
        return t('dashboard.validation.invalid-json', 'Not valid JSON');
    }
    if (dashboard && dashboard.hasOwnProperty('tags')) {
        if (Array.isArray(dashboard.tags)) {
            const hasInvalidTag = dashboard.tags.some((tag) => typeof tag !== 'string');
            if (hasInvalidTag) {
                return t('dashboard.validation.tags-expected-strings', 'tags expected array of strings');
            }
        }
        else {
            return t('dashboard.validation.tags-expected-array', 'tags expected array');
        }
    }
    return true;
};
export const validateGcomDashboard = (gcomDashboard) => {
    // From DashboardImportCtrl
    const match = /(^\d+$)|dashboards\/(\d+)/.exec(gcomDashboard);
    return match && (match[1] || match[2])
        ? true
        : t('dashboard.validation.invalid-dashboard-id', 'Could not find a valid Grafana.com ID');
};
export const validateTitle = (newTitle, folderUid) => {
    return validationSrv
        .validateNewDashboardName(folderUid, newTitle)
        .then(() => {
        return true;
    })
        .catch((error) => {
        if (error.type === 'EXISTING') {
            return error.message;
        }
    });
};
export const validateUid = (value) => {
    return getBackendSrv()
        .get(`/api/dashboards/uid/${value}`)
        .then((existingDashboard) => {
        return `Dashboard named '${existingDashboard === null || existingDashboard === void 0 ? void 0 : existingDashboard.dashboard.title}' in folder '${existingDashboard === null || existingDashboard === void 0 ? void 0 : existingDashboard.meta.folderTitle}' has the same UID`;
    })
        .catch((error) => {
        error.isHandled = true;
        return true;
    });
};
//# sourceMappingURL=validation.js.map