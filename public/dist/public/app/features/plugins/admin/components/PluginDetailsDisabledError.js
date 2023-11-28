import React from 'react';
import { PluginErrorCode } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Alert } from '@grafana/ui';
export function PluginDetailsDisabledError({ className, plugin }) {
    if (!plugin.isDisabled) {
        return null;
    }
    return (React.createElement(Alert, { severity: "error", title: "Plugin disabled", className: className, "aria-label": selectors.pages.PluginPage.disabledInfo },
        renderDescriptionFromError(plugin.error),
        React.createElement("p", null, "Please contact your server administrator to get this resolved."),
        React.createElement("a", { href: "https://grafana.com/docs/grafana/latest/administration/cli/#plugins-commands", className: "external-link", target: "_blank", rel: "noreferrer" }, "Read more about managing plugins")));
}
function renderDescriptionFromError(error) {
    switch (error) {
        case PluginErrorCode.modifiedSignature:
            return (React.createElement("p", null, "Grafana Labs checks each plugin to verify that it has a valid digital signature. While doing this, we discovered that the content of this plugin does not match its signature. We can not guarantee the trustworthy of this plugin and have therefore disabled it. We recommend you to reinstall the plugin to make sure you are running a verified version of this plugin."));
        case PluginErrorCode.invalidSignature:
            return (React.createElement("p", null, "Grafana Labs checks each plugin to verify that it has a valid digital signature. While doing this, we discovered that it was invalid. We can not guarantee the trustworthy of this plugin and have therefore disabled it. We recommend you to reinstall the plugin to make sure you are running a verified version of this plugin."));
        case PluginErrorCode.missingSignature:
            return (React.createElement("p", null, "Grafana Labs checks each plugin to verify that it has a valid digital signature. While doing this, we discovered that there is no signature for this plugin. We can not guarantee the trustworthy of this plugin and have therefore disabled it. We recommend you to reinstall the plugin to make sure you are running a verified version of this plugin."));
        default:
            return (React.createElement("p", null, "We failed to run this plugin due to an unkown reason and have therefore disabled it. We recommend you to reinstall the plugin to make sure you are running a working version of this plugin."));
    }
}
//# sourceMappingURL=PluginDetailsDisabledError.js.map