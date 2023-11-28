// Libraries
import React, { useMemo, useState } from 'react';
import { SceneApp, SceneAppPage } from '@grafana/scenes';
import { usePageNav } from 'app/core/components/Page/usePageNav';
import { PluginPageContext } from 'app/features/plugins/components/PluginPageContext';
import { getOverviewScene, getHttpHandlerListScene, getOverviewLogsScene, getHandlerDetailsScene, getHandlerLogsScene, } from './scenes';
import { getTrafficScene } from './traffic';
export function GrafanaMonitoringApp() {
    const appScene = useMemo(() => new SceneApp({
        pages: [getMainPageScene()],
    }), []);
    const sectionNav = usePageNav('scenes');
    const [pluginContext] = useState({ sectionNav });
    return (React.createElement(PluginPageContext.Provider, { value: pluginContext },
        React.createElement(appScene.Component, { model: appScene })));
}
export function getMainPageScene() {
    return new SceneAppPage({
        title: 'Grafana Monitoring',
        subTitle: 'A custom app with embedded scenes to monitor your Grafana server',
        url: '/scenes/grafana-monitoring',
        hideFromBreadcrumbs: false,
        getScene: getOverviewScene,
        tabs: [
            new SceneAppPage({
                title: 'Overview',
                url: '/scenes/grafana-monitoring',
                getScene: getOverviewScene,
                preserveUrlKeys: ['from', 'to', 'var-instance'],
            }),
            new SceneAppPage({
                title: 'HTTP handlers',
                url: '/scenes/grafana-monitoring/handlers',
                getScene: getHttpHandlerListScene,
                preserveUrlKeys: ['from', 'to', 'var-instance'],
                drilldowns: [
                    {
                        routePath: '/scenes/grafana-monitoring/handlers/:handler',
                        getPage: getHandlerDrilldownPage,
                    },
                ],
            }),
            new SceneAppPage({
                title: 'Traffic',
                url: '/scenes/grafana-monitoring/traffic',
                getScene: getTrafficScene,
                preserveUrlKeys: ['from', 'to', 'var-instance'],
            }),
            new SceneAppPage({
                title: 'Logs',
                url: '/scenes/grafana-monitoring/logs',
                getScene: getOverviewLogsScene,
                preserveUrlKeys: ['from', 'to', 'var-instance'],
            }),
        ],
    });
}
export function getHandlerDrilldownPage(match, parent) {
    const handler = decodeURIComponent(match.params.handler);
    const baseUrl = `/scenes/grafana-monitoring/handlers/${encodeURIComponent(handler)}`;
    return new SceneAppPage({
        title: handler,
        subTitle: 'A grafana http handler is responsible for service a specific API request',
        url: baseUrl,
        getParentPage: () => parent,
        getScene: () => getHandlerDetailsScene(handler),
        tabs: [
            new SceneAppPage({
                title: 'Metrics',
                url: baseUrl,
                routePath: '/scenes/grafana-monitoring/handlers/:handler',
                getScene: () => getHandlerDetailsScene(handler),
                preserveUrlKeys: ['from', 'to', 'var-instance'],
            }),
            new SceneAppPage({
                title: 'Logs',
                url: baseUrl + '/logs',
                routePath: '/scenes/grafana-monitoring/handlers/:handler/logs',
                getScene: () => getHandlerLogsScene(handler),
                preserveUrlKeys: ['from', 'to', 'var-instance'],
            }),
        ],
    });
}
export default GrafanaMonitoringApp;
//# sourceMappingURL=GrafanaMonitoringApp.js.map