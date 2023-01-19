import React from 'react';
import { Route, Switch, useRouteMatch } from 'react-router-dom';

import { NavModelItem } from '@grafana/data';
import { SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectStatePlain } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { getLinkUrlWithAppUrlState, useAppQueryParams } from '../../apps/utils';

export interface SceneAppState extends SceneObjectStatePlain {
  pages: SceneAppPage[];
}

export interface SceneRouteMatch<Params extends { [K in keyof Params]?: string } = {}> {
  params: Params;
  isExact: boolean;
  path: string;
  url: string;
}

export interface SceneAppRoute {
  path: string;
  page?: SceneAppPage;
  drilldown?: SceneAppDrilldownView;
}

export class SceneApp extends SceneObjectBase<SceneAppState> {
  public static Component = ({ model }: SceneComponentProps<SceneApp>) => {
    const { pages } = model.useState();

    return (
      <Switch>
        {pages.map((page) => (
          <Route key={page.state.url} exact={false} path={page.state.url}>
            {page && <page.Component model={page} />}
          </Route>
        ))}
      </Switch>
    );
  };
}

export interface SceneAppPageState extends SceneObjectStatePlain {
  title: string;
  url: string;
  routePath?: string;
  subTitle?: string;
  hideFromBreadcrumbs?: boolean;
  tabs?: SceneAppPage[];
  getScene: (routeMatch: SceneRouteMatch) => SceneObject;
  drilldowns?: SceneAppDrilldownView[];
  getParentPage?: () => SceneAppPage;
  preserveUrlKeys?: string[];
}

const sceneCache = new Map<string, SceneObject>();

export class SceneAppPage extends SceneObjectBase<SceneAppPageState> {
  public static Component = ({ model }: SceneComponentProps<SceneAppPage>) => {
    const { tabs } = model.state;

    if (tabs) {
      const routes: React.ReactNode[] = [];

      for (const page of tabs) {
        routes.push(
          <Route key={page.state.url} exact={true} path={page.state.routePath ?? page.state.url}>
            <page.Component model={page} />
          </Route>
        );

        if (page.state.drilldowns) {
          for (const drilldown of page.state.drilldowns) {
            console.log('registering drilldown route', drilldown.routePath);
            routes.push(
              <Route key={drilldown.routePath} exact={false} path={drilldown.routePath}>
                <SceneAppDrilldownViewRender drilldown={drilldown} parent={page} />
              </Route>
            );
          }
        }
      }

      return <Switch>{routes}</Switch>;
    }

    const routeMatch = useRouteMatch();
    console.log('routeMatch path', routeMatch.url);

    let scene = sceneCache.get(routeMatch.url);

    if (!scene) {
      scene = model.state.getScene(routeMatch);
      sceneCache.set(routeMatch.url, scene);
    }

    console.log('rendering page!', model.state.url);

    // if parent is a SceneAppPage we are a tab
    if (model.parent instanceof SceneAppPage) {
      return <PageRenderer page={model.parent} scene={scene} activeTab={model} tabs={model.parent.state.tabs} />;
    }

    return <PageRenderer page={model} scene={scene} />;
  };
}

interface ScenePageRenderProps {
  page: SceneAppPage;
  tabs?: SceneAppPage[];
  activeTab?: SceneAppPage;
  scene: SceneObject;
}

function PageRenderer({ page, tabs, activeTab, scene }: ScenePageRenderProps) {
  const params = useAppQueryParams();

  const pageNav: NavModelItem = {
    text: page.state.title,
    subTitle: page.state.subTitle,
    url: page.state.url,
    hideFromBreadcrumbs: page.state.hideFromBreadcrumbs,
    parentItem: getParentBreadcrumbs(page.state.getParentPage ? page.state.getParentPage() : page.parent),
  };

  if (tabs) {
    pageNav.children = tabs.map((tab) => ({
      text: tab.state.title,
      active: activeTab === tab,
      url: getLinkUrlWithAppUrlState(tab.state.url, params),
      parentItem: pageNav,
    }));
  }

  return (
    <Page navId="grafana-monitoring" pageNav={pageNav} hideFooter={true}>
      <Page.Contents>
        <scene.Component model={scene} />
      </Page.Contents>
    </Page>
  );
}

function getParentBreadcrumbs(parent: SceneObject | undefined): NavModelItem | undefined {
  if (parent instanceof SceneAppPage) {
    return {
      text: parent.state.title,
      url: parent.state.url,
      hideFromBreadcrumbs: parent.state.hideFromBreadcrumbs,
      parentItem: getParentBreadcrumbs(parent.state.getParentPage ? parent.state.getParentPage() : parent.parent),
    };
  }

  return undefined;
}

export interface SceneAppDrilldownView {
  routePath: string;
  getPage: (routeMatch: SceneRouteMatch<any>, parent: SceneAppPage) => SceneAppPage;
}

export function SceneAppDrilldownViewRender(props: { drilldown: SceneAppDrilldownView; parent: SceneAppPage }) {
  const routeMatch = useRouteMatch();
  const scene = props.drilldown.getPage(routeMatch, props.parent);
  console.log('drilldown!');
  return <scene.Component model={scene} />;
}
