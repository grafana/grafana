import * as React from 'react';
import { Route, Switch, useLocation } from 'react-router-dom';

import { DataSourcesRoutesContext } from 'app/features/datasources/state';
import { AppRootPage } from 'app/features/plugins/components/AppRootPage';
import { StoreState, useSelector } from 'app/types';

import { ROUTES } from './constants';
import {
  ConnectDataPage,
  DataSourceDetailsPage,
  DataSourcesListPage,
  EditDataSourcePage,
  NewDataSourcePage,
} from './pages';

export default function Connections() {
  const navIndex = useSelector((state: StoreState) => state.navIndex);
  const isCloud = Boolean(navIndex['standalone-plugin-page-/connections/connect-data']);
  const pluginServedPageIds = Object.keys(navIndex).filter((id) => id.includes('standalone-plugin-page-/connections'));
  const location = useLocation();

  return (
    <DataSourcesRoutesContext.Provider
      value={{
        New: ROUTES.DataSourcesNew,
        List: ROUTES.DataSources,
        Edit: ROUTES.DataSourcesEdit,
        Dashboards: ROUTES.DataSourcesDashboards,
      }}
    >
      <Switch>
        <Route exact path={ROUTES.Base} component={DataSourcesListPage} />
        <Route exact path={ROUTES.YourConnections} component={DataSourcesListPage} />

        <Route exact path={ROUTES.DataSources} component={DataSourcesListPage} />
        <Route exact path={ROUTES.DataSourcesDetails} component={DataSourceDetailsPage} />
        <Route exact path={ROUTES.DataSourcesNew} component={NewDataSourcePage} />
        <Route exact path={ROUTES.DataSourcesEdit} component={EditDataSourcePage} />
        {!isCloud && <Route path={ROUTES.ConnectData} component={ConnectDataPage} />}

        {/* 
          Standalone plugin pages 
          These pages are registered by plugins to show up under the connections section. 
          As we would like to keep using the "/connections/..." URL format we need to add explicit routing for them here. 
        */}
        {pluginServedPageIds.map((navId) => {
          const pluginId = navIndex[navId].registeredByPluginId;

          if (!pluginId) {
            return null;
          }

          return (
            <Route
              key={navId}
              path={navIndex[navId].url}
              render={({ match }) => (
                <AppRootPage
                  // @ts-ignore
                  route={{}}
                  match={{ ...match, url: '/connections', params: { ...match.params, pluginId } }}
                  queryParams={{}}
                  location={location}
                />
              )}
            />
          );
        })}

        {/* Default page */}
        <Route component={DataSourcesListPage} />
      </Switch>
    </DataSourcesRoutesContext.Provider>
  );
}
