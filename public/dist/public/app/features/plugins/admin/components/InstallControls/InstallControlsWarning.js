import { css } from '@emotion/css';
import React from 'react';
import { PluginType } from '@grafana/data';
import { config, featureEnabled } from '@grafana/runtime';
import { HorizontalGroup, Icon, LinkButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
import { getExternalManageLink } from '../../helpers';
import { useIsRemotePluginsAvailable } from '../../state/hooks';
import { PluginStatus } from '../../types';
export const InstallControlsWarning = ({ plugin, pluginStatus, latestCompatibleVersion }) => {
    const styles = useStyles2(getStyles);
    const isExternallyManaged = config.pluginAdminExternalManageEnabled;
    const hasPermission = contextSrv.hasPermission(AccessControlAction.PluginsInstall);
    const isRemotePluginsAvailable = useIsRemotePluginsAvailable();
    const isCompatible = Boolean(latestCompatibleVersion);
    if (plugin.type === PluginType.renderer) {
        return React.createElement("div", { className: styles.message }, "Renderer plugins cannot be managed by the Plugin Catalog.");
    }
    if (plugin.type === PluginType.secretsmanager) {
        return React.createElement("div", { className: styles.message }, "Secrets manager plugins cannot be managed by the Plugin Catalog.");
    }
    if (plugin.isEnterprise && !featureEnabled('enterprise.plugins')) {
        return (React.createElement(HorizontalGroup, { height: "auto", align: "center" },
            React.createElement("span", { className: styles.message }, "No valid Grafana Enterprise license detected."),
            React.createElement(LinkButton, { href: `${getExternalManageLink(plugin.id)}?utm_source=grafana_catalog_learn_more`, target: "_blank", rel: "noopener noreferrer", size: "sm", fill: "text", icon: "external-link-alt" }, "Learn more")));
    }
    if (plugin.isDev) {
        return (React.createElement("div", { className: styles.message }, "This is a development build of the plugin and can't be uninstalled."));
    }
    if (!hasPermission && !isExternallyManaged) {
        return React.createElement("div", { className: styles.message }, statusToMessage(pluginStatus));
    }
    if (!plugin.isPublished) {
        return (React.createElement("div", { className: styles.message },
            React.createElement(Icon, { name: "exclamation-triangle" }),
            " This plugin is not published to",
            ' ',
            React.createElement("a", { href: "https://www.grafana.com/plugins", target: "__blank", rel: "noreferrer" }, "grafana.com/plugins"),
            ' ',
            "and can't be managed via the catalog."));
    }
    if (!isCompatible) {
        return (React.createElement("div", { className: styles.message },
            React.createElement(Icon, { name: "exclamation-triangle" }),
            "\u00A0This plugin doesn't support your version of Grafana."));
    }
    if (!isRemotePluginsAvailable) {
        return (React.createElement("div", { className: styles.message }, "The install controls have been disabled because the Grafana server cannot access grafana.com."));
    }
    return null;
};
export const getStyles = (theme) => {
    return {
        message: css `
      color: ${theme.colors.text.secondary};
    `,
    };
};
function statusToMessage(status) {
    switch (status) {
        case PluginStatus.INSTALL:
        case PluginStatus.REINSTALL:
            return `You do not have permission to install this plugin.`;
        case PluginStatus.UNINSTALL:
            return `You do not have permission to uninstall this plugin.`;
        case PluginStatus.UPDATE:
            return `You do not have permission to update this plugin.`;
        default:
            return `You do not have permission to manage this plugin.`;
    }
}
//# sourceMappingURL=InstallControlsWarning.js.map