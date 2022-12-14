// Libraries
import React from 'react';
import { Route, Switch } from 'react-router-dom';

import { NavModelItem } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';

import { EmbeddedScene } from '../components/Scene';

import { HttpHandlerDetailsPage } from './HttpHandlerDetailsPage';
import { getOverviewScene, getHttpHandlerListScene } from './scenes';
import { getLinkUrlWithAppUrlState, useAppQueryParams } from './utils';

export function GrafanaMonitoringApp() {
  const tabs = getTabs();

  return (
    <Switch>
      {tabs.map((tab) => (
        <Route key={tab.url} exact={true} path={tab.url}>
          <AppPageWithTabs activeTab={tab} tabs={tabs} />
        </Route>
      ))}
      <Route exact={true} path="/scenes/grafana-monitoring/handlers/:handler" component={HttpHandlerDetailsPage} />
    </Switch>
  );
}

export interface AppPageProps {
  activeTab: AppTab;
  tabs: AppTab[];
}

export function AppPageWithTabs({ tabs, activeTab }: AppPageProps) {
  const scene = activeTab.getScene();
  const params = useAppQueryParams();

  const pageNav: NavModelItem = {
    text: 'Grafana Monitoring',
    subTitle: 'A custom app with embedded scenes to monitor your Grafana server',
    hideFromBreadcrumbs: true,
    children: tabs.map((tab) => ({
      text: tab.text,
      active: tab === activeTab,
      url: getLinkUrlWithAppUrlState(tab.url, params),
    })),
  };

  return (
    <Page navId="grafana-monitoring" pageNav={pageNav} hideFooter={true}>
      <Page.Contents>
        <scene.Component model={scene} />
      </Page.Contents>
    </Page>
  );
}

export interface AppTab extends NavModelItem {
  text: string;
  url: string;
  getScene: () => EmbeddedScene;
}

export function getTabs(): AppTab[] {
  return [
    { text: 'Overview', url: '/scenes/grafana-monitoring', getScene: getOverviewScene },
    { text: 'HTTP handlers', url: '/scenes/grafana-monitoring/handlers', getScene: getHttpHandlerListScene },
    { text: 'Alerts', url: '/scenes/grafana-monitoring/alerts', getScene: getHttpHandlerListScene },
  ];
}

export default GrafanaMonitoringApp;
