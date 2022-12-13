// Libraries
import React from 'react';
import { Route, Switch } from 'react-router-dom';

import { Tab, TabsBar } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { EmbeddedScene } from '../components/Scene';

import HttpHandlerScene from './HttpHandlerScene';
import { PageWithTabs, PageWithTabsBody } from './PageWithTabs';
import { getOverviewScene, getHttpHandlerListScene } from './state';

export function GrafanaMonitoringApp() {
  const tabs = getTabs();

  return (
    <Switch>
      {tabs.map((tab) => (
        <Route key={tab.href} exact={true} path={tab.href}>
          <AppPageWithTabs activeTab={tab} tabs={tabs} />
        </Route>
      ))}
      <Route exact={true} path="/scenes/grafana-monitoring/handlers/:handler" component={HttpHandlerScene} />
    </Switch>
  );
}

export interface AppPageProps {
  activeTab: AppTab;
  tabs: AppTab[];
}

export function AppPageWithTabs({ tabs, activeTab }: AppPageProps) {
  const scene = activeTab.getScene();

  return (
    <Page navId="grafana-monitoring" subTitle="A custom app with embedded scenes to monitor your Grafana server">
      <Page.Contents>
        <PageWithTabs>
          <TabsBar>
            {tabs.map((tab) => (
              <Tab key={tab.href} label={tab.title} active={activeTab === tab} href={tab.href} />
            ))}
          </TabsBar>
          <PageWithTabsBody>
            <scene.Component model={scene} />
          </PageWithTabsBody>
        </PageWithTabs>
      </Page.Contents>
    </Page>
  );
}

interface AppTab {
  title: string;
  href: string;
  getScene: () => EmbeddedScene;
}

function getTabs(): AppTab[] {
  return [
    { title: 'Overview', href: '/scenes/grafana-monitoring', getScene: getOverviewScene },
    { title: 'HTTP handlers', href: '/scenes/grafana-monitoring/handlers', getScene: getHttpHandlerListScene },
    { title: 'Alerts', href: '/scenes/grafana-monitoring/alerts', getScene: getHttpHandlerListScene },
  ];
}

export default GrafanaMonitoringApp;
