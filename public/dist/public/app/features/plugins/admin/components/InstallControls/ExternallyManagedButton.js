import React from 'react';
import { config } from '@grafana/runtime';
import { HorizontalGroup, LinkButton } from '@grafana/ui';
import { getExternalManageLink } from '../../helpers';
import { PluginStatus } from '../../types';
export function ExternallyManagedButton({ pluginId, pluginStatus, angularDetected }) {
    const externalManageLink = `${getExternalManageLink(pluginId)}/?tab=installation`;
    if (pluginStatus === PluginStatus.UPDATE) {
        return (React.createElement(HorizontalGroup, { height: "auto" },
            React.createElement(LinkButton, { href: externalManageLink, target: "_blank", rel: "noopener noreferrer" }, "Update via grafana.com"),
            React.createElement(LinkButton, { variant: "destructive", href: externalManageLink, target: "_blank", rel: "noopener noreferrer" }, "Uninstall via grafana.com")));
    }
    if (pluginStatus === PluginStatus.UNINSTALL) {
        return (React.createElement(LinkButton, { variant: "destructive", href: externalManageLink, target: "_blank", rel: "noopener noreferrer" }, "Uninstall via grafana.com"));
    }
    return (React.createElement(LinkButton, { disabled: !config.angularSupportEnabled && angularDetected, href: externalManageLink, target: "_blank", rel: "noopener noreferrer" }, "Install via grafana.com"));
}
//# sourceMappingURL=ExternallyManagedButton.js.map