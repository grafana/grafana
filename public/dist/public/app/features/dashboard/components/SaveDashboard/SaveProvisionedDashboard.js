import React from 'react';
import { Modal } from '@grafana/ui';
import { SaveProvisionedDashboardForm } from './forms/SaveProvisionedDashboardForm';
export var SaveProvisionedDashboard = function (_a) {
    var dashboard = _a.dashboard, onDismiss = _a.onDismiss;
    return (React.createElement(Modal, { isOpen: true, title: "Cannot save provisioned dashboard", icon: "copy", onDismiss: onDismiss },
        React.createElement(SaveProvisionedDashboardForm, { dashboard: dashboard, onCancel: onDismiss, onSuccess: onDismiss })));
};
//# sourceMappingURL=SaveProvisionedDashboard.js.map