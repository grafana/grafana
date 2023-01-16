import React from 'react';
import { Route, Switch, useRouteMatch } from 'react-router-dom';

import { NavModelItem } from '@grafana/data';
import { SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectStatePlain } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { getLinkUrlWithAppUrlState, useAppQueryParams } from '../../apps/utils';

export interface SceneAppState extends SceneObjectStatePlain {
  routes: SceneAppRoute[];
}

export interface SceneAppRoute {
  path: string;
  getScene: (routeMatch: SceneRouteMatch<any>) => SceneObject;
}

export interface SceneRouteMatch<Params extends { [K in keyof Params]?: string } = {}> {
  params: Params;
  isExact: boolean;
  path: string;
  url: string;
}

export class SceneApp extends SceneObjectBase<SceneAppState> {
  public static Component = ({ model }: SceneComponentProps<SceneApp>) => {
    const { routes } = model.useState();

    return (
      <Switch>
        {routes.map((route) => (
          <Route key={route.path} exact={true} path={route.path}>
            <SceneRouteComponent route={route} />
          </Route>
        ))}
      </Switch>
    );
  };
}

function SceneRouteComponent({ route }: { route: SceneAppRoute }) {
  const routeMatch = useRouteMatch();
  const scene = route.getScene(routeMatch);
  return <scene.Component model={scene} />;
}

export interface SceneAppPageState extends SceneObjectStatePlain {
  title: string;
  subTitle?: string;
  tabs: SceneAppTab[];
}

export interface SceneAppTab {
  text: string;
  url: string;
  getScene: (routeMatch: SceneRouteMatch) => SceneObject;
  preserveUrlKeys: string[];
}

export class SceneAppPage extends SceneObjectBase<SceneAppPageState> {
  public static Component = ({ model }: SceneComponentProps<SceneAppPage>) => {
    const { title, subTitle, tabs } = model.state;

    const params = useAppQueryParams();
    const routeMatch = useRouteMatch();
    const activeTab = tabs.find((tab) => tab.url === routeMatch.url);

    if (!activeTab) {
      return <div>Not found</div>;
    }

    const scene = activeTab.getScene(routeMatch);

    const pageNav: NavModelItem = {
      text: title,
      subTitle: subTitle,
      hideFromBreadcrumbs: true,
      children: tabs.map((tab) => ({
        text: tab.text,
        active: activeTab === tab,
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
  };
}
