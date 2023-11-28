import React from 'react';
import { Alert } from '@grafana/ui';
const NoAlertManagersAvailable = () => (React.createElement(Alert, { title: "No Alertmanager found", severity: "warning" }, "We could not find any external Alertmanagers and you may not have access to the built-in Grafana Alertmanager."));
const OtherAlertManagersAvailable = () => (React.createElement(Alert, { title: "Selected Alertmanager not found.", severity: "warning" }, "The selected Alertmanager no longer exists or you may not have permission to access it. You can select a different Alertmanager from the dropdown."));
export const NoAlertManagerWarning = ({ availableAlertManagers }) => {
    const hasOtherAMs = availableAlertManagers.length > 0;
    return React.createElement("div", null, hasOtherAMs ? React.createElement(OtherAlertManagersAvailable, null) : React.createElement(NoAlertManagersAvailable, null));
};
//# sourceMappingURL=NoAlertManagerWarning.js.map