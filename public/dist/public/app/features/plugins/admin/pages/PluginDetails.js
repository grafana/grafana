import { __makeTemplateObject } from "tslib";
import React, { useEffect } from 'react';
import { css } from '@emotion/css';
import { usePrevious } from 'react-use';
import { useStyles2, TabsBar, TabContent, Tab, Alert } from '@grafana/ui';
import { locationService } from '@grafana/runtime';
import { Layout } from '@grafana/ui/src/components/Layout/Layout';
import { Page } from 'app/core/components/Page/Page';
import { PluginDetailsSignature } from '../components/PluginDetailsSignature';
import { PluginDetailsHeader } from '../components/PluginDetailsHeader';
import { PluginDetailsBody } from '../components/PluginDetailsBody';
import { Page as PluginPage } from '../components/Page';
import { Loader } from '../components/Loader';
import { PluginTabLabels, PluginTabIds } from '../types';
import { useGetSingle, useFetchStatus, useFetchDetailsStatus } from '../state/hooks';
import { usePluginDetailsTabs } from '../hooks/usePluginDetailsTabs';
import { AppNotificationSeverity } from 'app/types';
import { PluginDetailsDisabledError } from '../components/PluginDetailsDisabledError';
export default function PluginDetails(_a) {
    var match = _a.match, queryParams = _a.queryParams;
    var _b = match.params.pluginId, pluginId = _b === void 0 ? '' : _b, url = match.url;
    var pageId = queryParams.page || PluginTabIds.OVERVIEW;
    var parentUrl = url.substring(0, url.lastIndexOf('/'));
    var defaultTabs = [
        {
            label: PluginTabLabels.OVERVIEW,
            icon: 'file-alt',
            id: PluginTabIds.OVERVIEW,
            href: url + "?page=" + PluginTabIds.OVERVIEW,
        },
        {
            label: PluginTabLabels.VERSIONS,
            icon: 'history',
            id: PluginTabIds.VERSIONS,
            href: url + "?page=" + PluginTabIds.VERSIONS,
        },
    ];
    var plugin = useGetSingle(pluginId); // fetches the localplugin settings
    var tabs = usePluginDetailsTabs(plugin, defaultTabs).tabs;
    var isFetchLoading = useFetchStatus().isLoading;
    var isFetchDetailsLoading = useFetchDetailsStatus().isLoading;
    var styles = useStyles2(getStyles);
    var prevTabs = usePrevious(tabs);
    // If an app plugin is uninstalled we need to reset the active tab when the config / dashboards tabs are removed.
    useEffect(function () {
        var hasUninstalledWithConfigPages = prevTabs && prevTabs.length > tabs.length;
        var isViewingAConfigPage = pageId !== PluginTabIds.OVERVIEW && pageId !== PluginTabIds.VERSIONS;
        if (hasUninstalledWithConfigPages && isViewingAConfigPage) {
            locationService.replace(url + "?page=" + PluginTabIds.OVERVIEW);
        }
    }, [pageId, url, tabs, prevTabs]);
    if (isFetchLoading || isFetchDetailsLoading) {
        return (React.createElement(Page, null,
            React.createElement(Loader, null)));
    }
    if (!plugin) {
        return (React.createElement(Layout, { justify: "center", align: "center" },
            React.createElement(Alert, { severity: AppNotificationSeverity.Warning, title: "Plugin not found" },
                "That plugin cannot be found. Please check the url is correct or ",
                React.createElement("br", null),
                "go to the ",
                React.createElement("a", { href: parentUrl }, "plugin catalog"),
                ".")));
    }
    return (React.createElement(Page, null,
        React.createElement(PluginPage, null,
            React.createElement(PluginDetailsHeader, { currentUrl: url + "?page=" + pageId, parentUrl: parentUrl, plugin: plugin }),
            React.createElement(TabsBar, null, tabs.map(function (tab) {
                return (React.createElement(Tab, { key: tab.label, label: tab.label, href: tab.href, icon: tab.icon, active: tab.id === pageId }));
            })),
            React.createElement(TabContent, { className: styles.tabContent },
                React.createElement(PluginDetailsDisabledError, { plugin: plugin, className: styles.alert }),
                React.createElement(PluginDetailsSignature, { plugin: plugin, className: styles.alert }),
                React.createElement(PluginDetailsBody, { queryParams: queryParams, plugin: plugin })))));
}
export var getStyles = function (theme) {
    return {
        alert: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin: ", ";\n      margin-bottom: 0;\n    "], ["\n      margin: ", ";\n      margin-bottom: 0;\n    "])), theme.spacing(3)),
        // Needed due to block formatting context
        tabContent: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      overflow: auto;\n    "], ["\n      overflow: auto;\n    "]))),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=PluginDetails.js.map