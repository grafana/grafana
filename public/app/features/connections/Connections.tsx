import * as React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';

import { NavLandingPage } from 'app/core/components/AppChrome/NavLandingPage';
import { DataSourcesRoutesContext } from 'app/features/datasources/state';
import { StoreState, useSelector } from 'app/types';

import { ROUTES } from './constants';
import {
  ConnectDataPage,
  DataSourceDashboardsPage,
  DataSourceDetailsPage,
  DataSourcesListPage,
  EditDataSourcePage,
  NewDataSourcePage,
} from './pages';

export default function Connections() {
  const navIndex = useSelector((state: StoreState) => state.navIndex);
  const isConnectDataPageOverriden = Boolean(navIndex['standalone-plugin-page-/connections/connect-data']);

  const YourConnectionsPage =
    navIndex['connections-your-connections'].children && navIndex['connections-your-connections'].children?.length > 1
      ? () => <NavLandingPage navId="connections-your-connections" />
      : () => <Redirect to={ROUTES.DataSources} />;

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
        {/* Redirect to "Connect data" by default */}
        <Route exact sensitive path={ROUTES.Base} component={() => <Redirect to={ROUTES.ConnectData} />} />
        <Route exact sensitive path={ROUTES.YourConnections} component={YourConnectionsPage} />
        <Route exact sensitive path={ROUTES.DataSources} component={DataSourcesListPage} />
        <Route exact sensitive path={ROUTES.DataSourcesDetails} component={DataSourceDetailsPage} />
        <Route exact sensitive path={ROUTES.DataSourcesNew} component={NewDataSourcePage} />
        <Route exact sensitive path={ROUTES.DataSourcesEdit} component={EditDataSourcePage} />
        <Route exact sensitive path={ROUTES.DataSourcesDashboards} component={DataSourceDashboardsPage} />

        {/* "Connect data" page - we don't register a route in case a plugin already registers a standalone page for it */}
        {!isConnectDataPageOverriden && <Route exact sensitive path={ROUTES.ConnectData} component={ConnectDataPage} />}

        {/* Not found */}
        <Route component={() => <Redirect to="/notfound" />} />
      </Switch>
    </DataSourcesRoutesContext.Provider>
  );
}
