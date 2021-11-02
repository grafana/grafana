import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { satisfies } from 'semver';
import { config } from '@grafana/runtime';
import { HorizontalGroup, Icon, LinkButton, useStyles2 } from '@grafana/ui';
import { PluginType } from '@grafana/data';
import { ExternallyManagedButton } from './ExternallyManagedButton';
import { InstallControlsButton } from './InstallControlsButton';
import { PluginStatus } from '../../types';
import { getExternalManageLink } from '../../helpers';
import { useIsRemotePluginsAvailable } from '../../state/hooks';
import { isGrafanaAdmin } from '../../permissions';
export var InstallControls = function (_a) {
    var _b, _c;
    var plugin = _a.plugin;
    var styles = useStyles2(getStyles);
    var isExternallyManaged = config.pluginAdminExternalManageEnabled;
    var hasPermission = isGrafanaAdmin();
    var grafanaDependency = (_b = plugin.details) === null || _b === void 0 ? void 0 : _b.grafanaDependency;
    var isRemotePluginsAvailable = useIsRemotePluginsAvailable();
    var unsupportedGrafanaVersion = grafanaDependency
        ? !satisfies(config.buildInfo.version, grafanaDependency, {
            // needed for when running against main
            includePrerelease: true,
        })
        : false;
    var pluginStatus = plugin.isInstalled
        ? plugin.hasUpdate
            ? PluginStatus.UPDATE
            : PluginStatus.UNINSTALL
        : PluginStatus.INSTALL;
    if (plugin.isCore || plugin.isDisabled || plugin.type === PluginType.renderer) {
        return null;
    }
    if (plugin.isEnterprise && !((_c = config.licenseInfo) === null || _c === void 0 ? void 0 : _c.hasValidLicense)) {
        return (React.createElement(HorizontalGroup, { height: "auto", align: "center" },
            React.createElement("span", { className: styles.message }, "No valid Grafana Enterprise license detected."),
            React.createElement(LinkButton, { href: getExternalManageLink(plugin.id) + "?utm_source=grafana_catalog_learn_more", target: "_blank", rel: "noopener noreferrer", size: "sm", fill: "text", icon: "external-link-alt" }, "Learn more")));
    }
    if (plugin.isDev) {
        return (React.createElement("div", { className: styles.message }, "This is a development build of the plugin and can't be uninstalled."));
    }
    if (!hasPermission && !isExternallyManaged) {
        var message = "You do not have permission to " + pluginStatus + " this plugin.";
        return React.createElement("div", { className: styles.message }, message);
    }
    if (unsupportedGrafanaVersion) {
        return (React.createElement("div", { className: styles.message },
            React.createElement(Icon, { name: "exclamation-triangle" }),
            "\u00A0This plugin doesn't support your version of Grafana."));
    }
    if (isExternallyManaged) {
        return React.createElement(ExternallyManagedButton, { pluginId: plugin.id, pluginStatus: pluginStatus });
    }
    if (!isRemotePluginsAvailable) {
        return (React.createElement("div", { className: styles.message }, "The install controls have been disabled because the Grafana server cannot access grafana.com."));
    }
    return React.createElement(InstallControlsButton, { plugin: plugin, pluginStatus: pluginStatus });
};
export var getStyles = function (theme) {
    return {
        message: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      color: ", ";\n    "], ["\n      color: ", ";\n    "])), theme.colors.text.secondary),
    };
};
var templateObject_1;
//# sourceMappingURL=index.js.map