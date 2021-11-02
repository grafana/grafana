import { __assign } from "tslib";
import React from 'react';
import { SaveProvisionedDashboard } from './SaveProvisionedDashboard';
import { SaveDashboardAsModal } from './SaveDashboardAsModal';
import { SaveDashboardModal } from './SaveDashboardModal';
export var SaveDashboardModalProxy = function (_a) {
    var dashboard = _a.dashboard, onDismiss = _a.onDismiss, onSaveSuccess = _a.onSaveSuccess;
    var isProvisioned = dashboard.meta.provisioned;
    var isNew = dashboard.version === 0;
    var isChanged = dashboard.version > 0;
    var modalProps = {
        dashboard: dashboard,
        onDismiss: onDismiss,
        onSaveSuccess: onSaveSuccess,
    };
    return (React.createElement(React.Fragment, null,
        isChanged && !isProvisioned && React.createElement(SaveDashboardModal, __assign({}, modalProps)),
        isProvisioned && React.createElement(SaveProvisionedDashboard, __assign({}, modalProps)),
        isNew && React.createElement(SaveDashboardAsModal, __assign({}, modalProps, { isNew: true }))));
};
//# sourceMappingURL=SaveDashboardModalProxy.js.map