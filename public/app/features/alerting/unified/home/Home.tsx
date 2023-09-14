import React, { useState } from 'react';

import { config } from '@grafana/runtime';
import { SceneApp, SceneAppPage } from '@grafana/scenes';
import { usePageNav } from 'app/core/components/Page/usePageNav';
import { PluginPageContext, PluginPageContextType } from 'app/features/plugins/components/PluginPageContext';

import { getOverviewScene, WelcomeHeader } from './GettingStarted';
import { getGrafanaScenes } from './Insights';

let homeApp: SceneApp | undefined;

export function getHomeApp(insightsEnabled: boolean) {
  if (homeApp) {
    return homeApp;
  }

  if (insightsEnabled) {
    homeApp = new SceneApp({
      pages: [
        new SceneAppPage({
          title: 'Alerting',
          subTitle: <WelcomeHeader />,
          url: '/alerting',
          hideFromBreadcrumbs: true,
          tabs: [
            new SceneAppPage({
              title: 'Grafana',
              url: '/alerting/home/insights',
              getScene: getGrafanaScenes,
            }),
            new SceneAppPage({
              title: 'Overview',
              url: '/alerting/home/overview',
              getScene: getOverviewScene,
            }),
          ],
        }),
      ],
    });
  } else {
    homeApp = new SceneApp({
      pages: [
        new SceneAppPage({
          title: 'Alerting',
          subTitle: <WelcomeHeader />,
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
  const insightsEnabled = !!config.featureToggles.alertingInsights;

  const appScene = getHomeApp(insightsEnabled);

  const sectionNav = usePageNav('alerting')!;
  const [pluginContext] = useState<PluginPageContextType>({ sectionNav });

  return (
    <PluginPageContext.Provider value={pluginContext}>
      <appScene.Component model={appScene} />
    </PluginPageContext.Provider>
  );
}
