import React from 'react';
import { Alert, Badge } from '@grafana/ui';
export var ProvisionedResource;
(function (ProvisionedResource) {
    ProvisionedResource["ContactPoint"] = "contact point";
    ProvisionedResource["Template"] = "template";
    ProvisionedResource["MuteTiming"] = "mute timing";
    ProvisionedResource["AlertRule"] = "alert rule";
    ProvisionedResource["RootNotificationPolicy"] = "root notification policy";
})(ProvisionedResource || (ProvisionedResource = {}));
export const ProvisioningAlert = ({ resource }) => {
    return (React.createElement(Alert, { title: `This ${resource} cannot be edited through the UI`, severity: "info" },
        "This ",
        resource,
        " has been provisioned, that means it was created by config. Please contact your server admin to update this ",
        resource,
        "."));
};
export const ProvisioningBadge = () => {
    return React.createElement(Badge, { text: 'Provisioned', color: 'purple' });
};
//# sourceMappingURL=Provisioning.js.map