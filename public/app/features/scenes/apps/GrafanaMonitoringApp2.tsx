// Libraries
import React from 'react';

import { SceneApp, SceneAppPage, SceneRouteMatch } from '../components/app/SceneApp';

import {
  getOverviewScene,
  getHttpHandlerListScene,
  getOverviewLogsScene,
  getHandlerDetailsScene,
  getHandlerLogsScene,
} from './scenes';

export function GrafanaMonitoringApp2() {
  const appScene = new SceneApp({
    routes: [
      { path: '/scenes/grafana-monitoring', getScene: getMainPageScene },
      { path: '/scenes/grafana-monitoring/handlers', getScene: getMainPageScene },
      { path: '/scenes/grafana-monitoring/handlers/:handler', getScene: getDrilldownPageScene },
      { path: '/scenes/grafana-monitoring/handlers/:handler/:tab', getScene: getDrilldownPageScene },
    ],
  });

  return <appScene.Component model={appScene} />;
}

export function getMainPageScene() {
  return new SceneAppPage({
    title: 'Grafana Monitoring',
    subTitle: 'A custom app with embedded scenes to monitor your Grafana server',
    tabs: [
      {
        text: 'Overview',
        url: '/scenes/grafana-monitoring',
        getScene: getOverviewScene,
        preserveUrlKeys: ['from', 'to', 'var-instance'],
      },
      {
        text: 'HTTP handlers',
        url: '/scenes/grafana-monitoring/handlers',
        getScene: getHttpHandlerListScene,
        preserveUrlKeys: ['from', 'to', 'var-instance'],
      },
      {
        text: 'Logs',
        url: '/scenes/grafana-monitoring/logs',
        getScene: getOverviewLogsScene,
        preserveUrlKeys: ['from', 'to', 'var-instance'],
      },
    ],
  });
}

export function getDrilldownPageScene(match: SceneRouteMatch<{ handler: string; tab?: string }>) {
  const handler = decodeURIComponent(match.params.handler);
  const baseUrl = `/scenes/grafana-monitoring/handlers/${encodeURIComponent(handler)}`;

  return new SceneAppPage({
    title: handler,
    subTitle: 'A grafana http handler is responsible for service a specific API request',
    tabs: [
      {
        text: 'Metrics',
        url: baseUrl,
        getScene: () => getHandlerDetailsScene(handler),
        preserveUrlKeys: ['from', 'to', 'var-instance'],
      },
      {
        text: 'Logs',
        url: baseUrl + '/logs',
        getScene: () => getHandlerLogsScene(handler),
        preserveUrlKeys: ['from', 'to', 'var-instance'],
      },
    ],
  });
}

export default GrafanaMonitoringApp2;
