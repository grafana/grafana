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
  // private collectRoutes(pages: SceneAppPage[], routes: SceneAppRoute[]) {
  //   for (const page of pages) {
  //     const { tabs, drilldowns } = page.state;

  //     if (tabs) {
  //       this.collectRoutes(tabs, routes);
  //     }

  //     if (drilldowns) {
  //       for (const drilldown of drilldowns) {
  //         routes.push({
  //           path: drilldown.state.routePath,
  //           drilldown,
  //         });
  //       }
  //     }

  //     routes.push({
  //       path: page.state.url,
  //       page,
  //     });
  //   }

  //   return routes;
  // }

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
  subTitle?: string;
  tabs?: SceneAppPage[];
  getScene: (routeMatch: SceneRouteMatch) => SceneObject;
  drilldowns?: SceneAppDrilldownView[];
  drilldownParent?: SceneAppPage | SceneAppDrilldownView;
  preserveUrlKeys?: string[];
}

export interface SceneAppDrilldownViewState extends SceneObjectStatePlain {
  routePath: string;
  getPage: (routeMatch: SceneRouteMatch<any>, parent: SceneObject) => SceneAppPage;
  drilldowns?: SceneAppDrilldownView[];
}

export class SceneAppDrilldownView extends SceneObjectBase<SceneAppDrilldownViewState> {
  public static Component = ({ model }: SceneComponentProps<SceneAppDrilldownView>) => {
    const { getPage } = model.useState();
    const routeMatch = useRouteMatch();
    const scene = getPage(routeMatch, model.parent!);
    console.log('drilldown!');
    return <scene.Component model={scene} />;
  };
}

export class SceneAppPage extends SceneObjectBase<SceneAppPageState> {
  public static Component = ({ model }: SceneComponentProps<SceneAppPage>) => {
    const { title, subTitle, drilldownParent, tabs, drilldowns } = model.state;

    if (tabs) {
      const routes: React.ReactNode[] = [];

      for (const page of tabs) {
        routes.push(
          <Route key={page.state.url} exact={true} path={page.state.url}>
            <page.Component model={page} />
          </Route>
        );

        if (page.state.drilldowns) {
          for (const drilldown of page.state.drilldowns) {
            console.log('registering drilldown route', drilldown.state.routePath);
            routes.push(
              <Route key={drilldown.state.routePath} exact={false} path={drilldown.state.routePath}>
                <drilldown.Component model={drilldown} />
              </Route>
            );
          }
        }
      }

      return <Switch>{routes}</Switch>;
    }

    const routeMatch = useRouteMatch();
    const scene = model.state.getScene(routeMatch);

    console.log('rendering page!', model.state.url);

    // if parent is a SceneAppPage we are a tab
    if (model.parent instanceof SceneAppPage) {
      return (
        <PageRenderer
          page={model.parent}
          scene={scene}
          parent={model.parent}
          activeTab={model}
          tabs={model.parent.state.tabs}
        />
      );
    }

    return <PageRenderer page={model} scene={scene} parent={drilldownParent || model} />;
  };
}

interface ScenePageRenderProps {
  page: SceneAppPage;
  tabs?: SceneAppPage[];
  activeTab?: SceneAppPage;
  scene: SceneObject;
  parent: SceneAppPage | SceneAppDrilldownView;
}

function PageRenderer({ page, tabs, activeTab, scene, parent }: ScenePageRenderProps) {
  const params = useAppQueryParams();

  const pageNav: NavModelItem = {
    text: page.state.title,
    subTitle: page.state.subTitle,
    hideFromBreadcrumbs: true,
  };

  if (tabs) {
    pageNav.children = tabs.map((tab) => ({
      text: tab.state.title,
      active: activeTab === tab,
      url: getLinkUrlWithAppUrlState(tab.state.url, params),
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

// public static Component = ({ model }: SceneComponentProps<SceneAppPage>) => {
//   const { title, subTitle, tabs } = model.state;

//   const params = useAppQueryParams();
//   const routeMatch = useRouteMatch();
//   const activeTab = tabs.find((tab) => tab.url === routeMatch.url);

//   if (!activeTab) {
//     return <div>Not found</div>;
//   }

//   const scene = activeTab.getScene(routeMatch);

//   const pageNav: NavModelItem = {
//     text: title,
//     subTitle: subTitle,
//     hideFromBreadcrumbs: true,
//     children: tabs.map((tab) => ({
//       text: tab.text,
//       active: activeTab === tab,
//       url: getLinkUrlWithAppUrlState(tab.url, params),
//     })),
//   };

//   return (
//     <Page navId="grafana-monitoring" pageNav={pageNav} hideFooter={true}>
//       <Page.Contents>
//         <scene.Component model={scene} />
//       </Page.Contents>
//     </Page>
//   );
// };
