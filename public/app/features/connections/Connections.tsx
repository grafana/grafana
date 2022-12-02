import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { Route, Switch } from 'react-router-dom';

import { DataSourcesRoutesContext } from 'app/features/datasources/state';
import { StoreState, useSelector } from 'app/types';

import { ROUTES } from './constants';
import {
  PluginRecipesPage,
  ConnectDataPage,
  DataSourceDetailsPage,
  DataSourcesListPage,
  EditDataSourcePage,
  NewDataSourcePage,
} from './pages';

export default function Connections() {
  const navIndex = useSelector((state: StoreState) => state.navIndex);
  const isConnectDataPageOverriden = Boolean(navIndex['standalone-plugin-page-/connections/connect-data']);
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
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
          {!isConnectDataPageOverriden && <Route path={ROUTES.ConnectData} component={ConnectDataPage} />}

          {/* Plugin Recipes */}
          <Route exact path={ROUTES.PluginRecipes} component={PluginRecipesPage} />
          <Route exact path={ROUTES.PluginRecipeDetails} component={PluginRecipeDetailsPage} />

          {/* Default page */}
          <Route component={DataSourcesListPage} />
        </Switch>
      </DataSourcesRoutesContext.Provider>
    </QueryClientProvider>
  );
}
