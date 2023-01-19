// Libraries
import React from 'react';

import { SceneCanvasText, SceneFlexLayout } from '@grafana/scenes';

import { SceneApp, SceneAppDrilldownView, SceneAppPage, SceneRouteMatch } from '../components/app/SceneApp';

import {
  getOverviewScene,
  getHttpHandlerListScene,
  getOverviewLogsScene,
  getHandlerDetailsScene,
  getHandlerLogsScene,
} from './scenes';

export function GrafanaMonitoringApp2() {
  const appScene = new SceneApp({
    pages: [getMainPageScene()],
    // routes: [
    //   { path: '/scenes/grafana-monitoring', getScene: getMainPageScene },
    //   { path: '/scenes/grafana-monitoring/handlers', getScene: getMainPageScene },
    //   { path: '/scenes/grafana-monitoring/logs', getScene: getMainPageScene },
    //   { path: '/scenes/grafana-monitoring/handlers/:handler', getScene: getDrilldownPageScene },
    //   { path: '/scenes/grafana-monitoring/handlers/:handler/:tab', getScene: getDrilldownPageScene },
    // ],
  });

  return <appScene.Component model={appScene} />;
}

export function getMainPageScene() {
  return new SceneAppPage({
    title: 'Grafana Monitoring',
    subTitle: 'A custom app with embedded scenes to monitor your Grafana server',
    url: '/scenes/grafana-monitoring',
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
          new SceneAppDrilldownView({
            routePath: '/scenes/grafana-monitoring/handlers/:handler',
            getPage: getDrilldownPageScene,
          }),
        ],
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

export function getDrilldownPageScene(match: SceneRouteMatch<{ handler: string; tab?: string }>) {
  const handler = decodeURIComponent(match.params.handler);
  const baseUrl = `/scenes/grafana-monitoring/handlers/${encodeURIComponent(handler)}`;

  return new SceneAppPage({
    title: handler,
    subTitle: 'A grafana http handler is responsible for service a specific API request',
    url: baseUrl,
    getScene: () => getHandlerDetailsScene(handler),
    tabs: [
      new SceneAppPage({
        title: 'Metrics',
        url: baseUrl,
        getScene: () => getHandlerDetailsScene(handler),
        preserveUrlKeys: ['from', 'to', 'var-instance'],
      }),
      new SceneAppPage({
        title: 'Logs',
        url: baseUrl + '/logs',
        getScene: () => getHandlerLogsScene(handler),
        preserveUrlKeys: ['from', 'to', 'var-instance'],
        drilldowns: [
          new SceneAppDrilldownView({
            routePath: '/scenes/grafana-monitoring/handlers/:handler/logs/:drilldown',
            getPage: getHandlerDrilldown,
          }),
        ],
      }),
    ],
  });
}

export function getHandlerDrilldown(match: SceneRouteMatch<{ handler: string; drilldown: string }>) {
  const handler = decodeURIComponent(match.params.handler);
  const drilldown = decodeURIComponent(match.params.drilldown);
  const baseUrl = `/scenes/grafana-monitoring/handlers/${encodeURIComponent(handler)}/logs/${drilldown}`;

  return new SceneAppPage({
    title: handler + ' ' + drilldown,
    subTitle: 'A grafana http handler is responsible for service a specific API request',
    url: baseUrl,
    getScene: () => {
      return new SceneFlexLayout({
        children: [
          new SceneCanvasText({
            text: 'Drilldown: ' + drilldown,
          }),
        ],
      });
    },
  });
}

export default GrafanaMonitoringApp2;
