import { css } from '@emotion/css';
import React from 'react';
import { useLocation } from 'react-router-dom';
import { config } from '@grafana/runtime';
import { useStyles2, TabContent, Alert } from '@grafana/ui';
import { Layout } from '@grafana/ui/src/components/Layout/Layout';
import { Page } from 'app/core/components/Page/Page';
import { AppNotificationSeverity } from 'app/types';
import { AngularDeprecationPluginNotice } from '../../angularDeprecation/AngularDeprecationPluginNotice';
import { Loader } from '../components/Loader';
import { PluginDetailsBody } from '../components/PluginDetailsBody';
import { PluginDetailsDisabledError } from '../components/PluginDetailsDisabledError';
import { PluginDetailsSignature } from '../components/PluginDetailsSignature';
import { usePluginDetailsTabs } from '../hooks/usePluginDetailsTabs';
import { usePluginPageExtensions } from '../hooks/usePluginPageExtensions';
import { useGetSingle, useFetchStatus, useFetchDetailsStatus } from '../state/hooks';
import { PluginDetailsDeprecatedWarning } from './PluginDetailsDeprecatedWarning';
export function PluginDetailsPage({ pluginId, navId = 'plugins', notFoundComponent = React.createElement(NotFoundPlugin, null), notFoundNavModel = {
    text: 'Unknown plugin',
    subTitle: 'The requested ID does not belong to any plugin',
    active: true,
}, }) {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const plugin = useGetSingle(pluginId); // fetches the plugin settings for this Grafana instance
    const { navModel, activePageId } = usePluginDetailsTabs(plugin, queryParams.get('page'));
    const { actions, info, subtitle } = usePluginPageExtensions(plugin);
    const { isLoading: isFetchLoading } = useFetchStatus();
    const { isLoading: isFetchDetailsLoading } = useFetchDetailsStatus();
    const styles = useStyles2(getStyles);
    if (isFetchLoading || isFetchDetailsLoading) {
        return (React.createElement(Page, { navId: navId, pageNav: {
                text: '',
                active: true,
            } },
            React.createElement(Loader, null)));
    }
    if (!plugin) {
        return (React.createElement(Page, { navId: navId, pageNav: notFoundNavModel }, notFoundComponent));
    }
    return (React.createElement(Page, { navId: navId, pageNav: navModel, actions: actions, subTitle: subtitle, info: info },
        React.createElement(Page.Contents, null,
            React.createElement(TabContent, { className: styles.tabContent },
                plugin.angularDetected && (React.createElement(AngularDeprecationPluginNotice, { className: styles.alert, angularSupportEnabled: config === null || config === void 0 ? void 0 : config.angularSupportEnabled, pluginId: plugin.id, pluginType: plugin.type, showPluginDetailsLink: false, interactionElementId: "plugin-details-page" })),
                React.createElement(PluginDetailsSignature, { plugin: plugin, className: styles.alert }),
                React.createElement(PluginDetailsDisabledError, { plugin: plugin, className: styles.alert }),
                React.createElement(PluginDetailsDeprecatedWarning, { plugin: plugin, className: styles.alert }),
                React.createElement(PluginDetailsBody, { queryParams: Object.fromEntries(queryParams), plugin: plugin, pageId: activePageId })))));
}
export const getStyles = (theme) => {
    return {
        alert: css `
      margin-bottom: ${theme.spacing(2)};
    `,
        subtitle: css `
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(1)};
    `,
        // Needed due to block formatting context
        tabContent: css `
      overflow: auto;
      height: 100%;
    `,
    };
};
function NotFoundPlugin() {
    return (React.createElement(Layout, { justify: "center", align: "center" },
        React.createElement(Alert, { severity: AppNotificationSeverity.Warning, title: "Plugin not found" },
            "That plugin cannot be found. Please check the url is correct or ",
            React.createElement("br", null),
            "go to the ",
            React.createElement("a", { href: "/plugins" }, "plugin catalog"),
            ".")));
}
//# sourceMappingURL=PluginDetailsPage.js.map