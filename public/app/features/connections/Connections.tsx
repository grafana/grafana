import * as React from 'react';
import { Route, Switch } from 'react-router-dom';

import { NavLandingPage } from 'app/core/components/AppChrome/NavLandingPage';
import { useNavItem } from 'app/core/components/Page/usePageNav';
import { DataSourcesRoutesContext } from 'app/features/datasources/state';

import { ROUTES } from './constants';
import {
  ConnectDataPage,
  DataSourceDetailsPage,
  DataSourcesListPage,
  EditDataSourcePage,
  NewDataSourcePage,
} from './pages';

export default function Connections() {
  const navModel = useNavItem('standalone-plugin-page-/connections/connect-data');
  const isConnectDataPageOverriden = Boolean(navModel);

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
        <Route exact path={ROUTES.Base} component={() => <NavLandingPage navId="connections" />} />
        <Route
          exact
          path={ROUTES.YourConnections}
          component={() => <NavLandingPage navId="connections-your-connections" />}
        />
        <Route exact path={ROUTES.DataSources} component={DataSourcesListPage} />
        <Route exact path={ROUTES.DataSourcesDetails} component={DataSourceDetailsPage} />
        <Route exact path={ROUTES.DataSourcesNew} component={NewDataSourcePage} />
        <Route exact path={ROUTES.DataSourcesEdit} component={EditDataSourcePage} />
        {!isConnectDataPageOverriden && <Route path={ROUTES.ConnectData} component={ConnectDataPage} />}

        {/* Default page */}
        <Route component={DataSourcesListPage} />
      </Switch>
    </DataSourcesRoutesContext.Provider>
  );
}
