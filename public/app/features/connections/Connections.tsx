import { Route, Switch, useLocation } from 'react-router-dom';
import { Navigate } from 'react-router-dom-v5-compat';

import { DataSourcesRoutesContext } from 'app/features/datasources/state';
import { StoreState, useSelector } from 'app/types';

import { ROUTES } from './constants';
import {
  AddNewConnectionPage,
  DataSourceDashboardsPage,
  DataSourceDetailsPage,
  DataSourcesListPage,
  EditDataSourcePage,
  NewDataSourcePage,
} from './pages';

function RedirectToAddNewConnection() {
  const { search } = useLocation();
  return (
    <Navigate
      replace
      to={{
        pathname: ROUTES.AddNewConnection,
        search,
      }}
    />
  );
}

export default function Connections() {
  const navIndex = useSelector((state: StoreState) => state.navIndex);
  const isAddNewConnectionPageOverridden = Boolean(navIndex['standalone-plugin-page-/connections/add-new-connection']);

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
        {/* Redirect to "Add new connection" by default */}
        <Route exact sensitive path={ROUTES.Base} component={() => <Navigate replace to={ROUTES.AddNewConnection} />} />
        <Route exact sensitive path={ROUTES.DataSources} component={DataSourcesListPage} />
        <Route exact sensitive path={ROUTES.DataSourcesNew} component={NewDataSourcePage} />
        <Route exact sensitive path={ROUTES.DataSourcesDetails} component={DataSourceDetailsPage} />
        <Route exact sensitive path={ROUTES.DataSourcesEdit} component={EditDataSourcePage} />
        <Route exact sensitive path={ROUTES.DataSourcesDashboards} component={DataSourceDashboardsPage} />

        {/* "Add new connection" page - we don't register a route in case a plugin already registers a standalone page for it */}
        {!isAddNewConnectionPageOverridden && (
          <Route exact sensitive path={ROUTES.AddNewConnection} component={AddNewConnectionPage} />
        )}

        {/* Redirect from earlier routes to updated routes */}
        <Route exact path={ROUTES.ConnectDataOutdated} component={RedirectToAddNewConnection} />
        <Route
          path={`${ROUTES.Base}/your-connections/:page`}
          component={() => <Navigate replace to={`${ROUTES.Base}/:page`} />}
        />
        <Route path={ROUTES.YourConnectionsOutdated} component={() => <Navigate replace to={ROUTES.DataSources} />} />

        {/* Not found */}
        <Route component={() => <Navigate replace to="/notfound" />} />
      </Switch>
    </DataSourcesRoutesContext.Provider>
  );
}
