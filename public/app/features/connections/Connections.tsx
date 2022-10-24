import * as React from 'react';
import { Route, Switch } from 'react-router-dom';

import { DataSourcesRoutesContext } from 'app/features/datasources/state';
import { AppPluginLoader } from 'app/features/plugins/components/AppPluginLoader';
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
  const isCloud = Boolean(navIndex['standalone-plugin-page-/connections/agent']);

  console.log({ isCloud });

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
        <Route exact path={ROUTES.YourConnections} component={DataSourcesListPage} />

        <Route exact path={ROUTES.DataSources} component={DataSourcesListPage} />
        <Route exact path={ROUTES.DataSourcesDetails} component={DataSourceDetailsPage} />
        <Route exact path={ROUTES.DataSourcesNew} component={NewDataSourcePage} />
        <Route exact path={ROUTES.DataSourcesEdit} component={EditDataSourcePage} />

        {/* Connect Data  - serve from the core by default, unless the Cloud Onboarding app is available and enabled */}
        {/* TODO: update the navIndex to contain the plugin id for any standalone plugin pages */}
        {!isCloud && <Route path={ROUTES.ConnectData} component={ConnectDataPage} />}
        {isCloud && <AppPluginLoader id="grafana-easystart-app" />}

        {/* Plugin routes - route any plugin registered page to the plugins */}

        {/* Default page */}
        <Route component={DataSourcesListPage} />
      </Switch>
    </DataSourcesRoutesContext.Provider>
  );
}
