// Libraries
import React from 'react';
import { Route, Switch } from 'react-router-dom';

import { Page } from 'app/core/components/Page/Page';

import HttpHandlerScene from './HttpHandlerScene';
import { getTopLevelScene } from './state';

export function TopLevelScene() {
  const scene = getTopLevelScene();

  return (
    <Page navId="grafana-monitoring" subTitle="A custom app with embedded scenes to monitor your Grafana server">
      <Page.Contents>
        <scene.Component model={scene} />
      </Page.Contents>
    </Page>
  );
}

export function GrafanaMonitoringApp() {
  return (
    <Switch>
      <Route exact={true} path="/scenes/grafana-monitoring">
        <TopLevelScene />
      </Route>
      <Route exact={true} path="/scenes/grafana-monitoring/handlers/:handler">
        <HttpHandlerScene />
      </Route>
    </Switch>
  );
}

export default GrafanaMonitoringApp;
