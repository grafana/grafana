import validationSrv from '../services/ValidationSrv';
import { getBackendSrv } from '@grafana/runtime';
export var validateDashboardJson = function (json) {
    try {
        JSON.parse(json);
        return true;
    }
    catch (error) {
        return 'Not valid JSON';
    }
};
export var validateGcomDashboard = function (gcomDashboard) {
    // From DashboardImportCtrl
    var match = /(^\d+$)|dashboards\/(\d+)/.exec(gcomDashboard);
    return match && (match[1] || match[2]) ? true : 'Could not find a valid Grafana.com ID';
};
export var validateTitle = function (newTitle, folderId) {
    return validationSrv
        .validateNewDashboardName(folderId, newTitle)
        .then(function () {
        return true;
    })
        .catch(function (error) {
        if (error.type === 'EXISTING') {
            return error.message;
        }
    });
};
export var validateUid = function (value) {
    return getBackendSrv()
        .get("/api/dashboards/uid/" + value)
        .then(function (existingDashboard) {
        return "Dashboard named '" + (existingDashboard === null || existingDashboard === void 0 ? void 0 : existingDashboard.dashboard.title) + "' in folder '" + (existingDashboard === null || existingDashboard === void 0 ? void 0 : existingDashboard.meta.folderTitle) + "' has the same UID";
    })
        .catch(function (error) {
        error.isHandled = true;
        return true;
    });
};
//# sourceMappingURL=validation.js.map