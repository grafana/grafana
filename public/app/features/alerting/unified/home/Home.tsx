import React, { useState } from 'react';

import {
  EmbeddedScene,
  SceneApp,
  SceneAppPage,
  SceneFlexItem,
  SceneFlexLayout,
  SceneReactObject,
} from '@grafana/scenes';
import { usePageNav } from 'app/core/components/Page/usePageNav';
import { PluginPageContext, PluginPageContextType } from 'app/features/plugins/components/PluginPageContext';

import GettingStarted, { WelcomeHeader } from './GettingStarted';
import { getGrafanaScenes } from './Insights';

let homeApp: SceneApp | undefined;

export function getHomeApp() {
  if (homeApp) {
    return homeApp;
  }

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
            url: '/alerting/insights',
            getScene: getGrafanaScenes,
          }),
          new SceneAppPage({
            title: 'Overview',
            url: '/alerting/overview',
            getScene: () => {
              return new EmbeddedScene({
                body: new SceneFlexLayout({
                  children: [
                    new SceneFlexItem({
                      body: new SceneReactObject({
                        component: GettingStarted,
                      }),
                    }),
                  ],
                }),
              });
            },
          }),
          // new SceneAppPage({
          //   title: 'Mimir alertmanager',
          //   url: '/alerting/insights/mimir-alertmanager',
          //   getScene: getCloudScenes,
          // }),
          // new SceneAppPage({
          //   title: 'Mimir-managed rules',
          //   url: '/alerting/insights/mimir-rules',
          //   getScene: getMimirManagedRulesScenes,
          // }),
          // new SceneAppPage({
          //   title: 'Mimir-managed Rules - Per Rule Group',
          //   url: '/alerting/insights/mimir-rules-per-group',
          //   getScene: getMimirManagedRulesPerGroupScenes,
          // }),
        ],
      }),
    ],
  });

  return homeApp;
}

export default function Home() {
  const appScene = getHomeApp();

  const sectionNav = usePageNav('alerting')!;
  const [pluginContext] = useState<PluginPageContextType>({ sectionNav });

  return (
    <PluginPageContext.Provider value={pluginContext}>
      <appScene.Component model={appScene} />
    </PluginPageContext.Provider>
  );
}
