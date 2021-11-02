import React from 'react';
import { HorizontalGroup, LinkButton } from '@grafana/ui';
import { getExternalManageLink } from '../../helpers';
import { PluginStatus } from '../../types';
export function ExternallyManagedButton(_a) {
    var pluginId = _a.pluginId, pluginStatus = _a.pluginStatus;
    var externalManageLink = getExternalManageLink(pluginId) + "/?tab=installation";
    if (pluginStatus === PluginStatus.UPDATE) {
        return (React.createElement(HorizontalGroup, { height: "auto" },
            React.createElement(LinkButton, { href: externalManageLink, target: "_blank", rel: "noopener noreferrer" }, "Update via grafana.com"),
            React.createElement(LinkButton, { variant: "destructive", href: externalManageLink, target: "_blank", rel: "noopener noreferrer" }, "Uninstall via grafana.com")));
    }
    if (pluginStatus === PluginStatus.UNINSTALL) {
        return (React.createElement(LinkButton, { variant: "destructive", href: externalManageLink, target: "_blank", rel: "noopener noreferrer" }, "Uninstall via grafana.com"));
    }
    return (React.createElement(LinkButton, { href: externalManageLink, target: "_blank", rel: "noopener noreferrer" }, "Install via grafana.com"));
}
//# sourceMappingURL=ExternallyManagedButton.js.map