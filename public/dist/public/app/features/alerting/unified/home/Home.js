import React, { useState } from 'react';
import { config } from '@grafana/runtime';
import { SceneApp, SceneAppPage } from '@grafana/scenes';
import { usePageNav } from 'app/core/components/Page/usePageNav';
import { PluginPageContext } from 'app/features/plugins/components/PluginPageContext';
import { isLocalDevEnv, isOpenSourceEdition } from '../utils/misc';
import { getOverviewScene, WelcomeHeader } from './GettingStarted';
import { getInsightsScenes } from './Insights';
let homeApp;
export function getHomeApp(insightsEnabled) {
    if (homeApp) {
        return homeApp;
    }
    if (insightsEnabled) {
        homeApp = new SceneApp({
            pages: [
                new SceneAppPage({
                    title: 'Alerting',
                    subTitle: React.createElement(WelcomeHeader, null),
                    url: '/alerting',
                    hideFromBreadcrumbs: true,
                    tabs: [
                        new SceneAppPage({
                            title: 'Insights',
                            url: '/alerting/home/insights',
                            getScene: getInsightsScenes,
                        }),
                        new SceneAppPage({
                            title: 'Get started',
                            url: '/alerting/home/overview',
                            getScene: getOverviewScene,
                        }),
                    ],
                }),
            ],
        });
    }
    else {
        homeApp = new SceneApp({
            pages: [
                new SceneAppPage({
                    title: 'Alerting',
                    subTitle: React.createElement(WelcomeHeader, null),
                    url: '/alerting',
                    hideFromBreadcrumbs: true,
                    getScene: getOverviewScene,
                }),
            ],
        });
    }
    return homeApp;
}
export default function Home() {
    const insightsEnabled = (!isOpenSourceEdition() || isLocalDevEnv()) && Boolean(config.featureToggles.alertingInsights);
    const appScene = getHomeApp(insightsEnabled);
    const sectionNav = usePageNav('alerting');
    const [pluginContext] = useState({ sectionNav });
    return (React.createElement(PluginPageContext.Provider, { value: pluginContext },
        React.createElement(appScene.Component, { model: appScene })));
}
//# sourceMappingURL=Home.js.map