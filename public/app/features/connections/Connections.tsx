import { Navigate, Routes, Route, useLocation } from 'react-router-dom-v5-compat';

import { DataSourcesRoutesContext } from 'app/features/datasources/state';
import { StoreState, useSelector } from 'app/types';

import { RELATIVE_ROUTES as ROUTES } from './constants';
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
      <Routes>
        {/* Redirect to "Add new connection" by default */}
        <Route caseSensitive path={'/'} element={<Navigate replace to={ROUTES.AddNewConnection} />} />
        <Route caseSensitive path={ROUTES.DataSources} element={<DataSourcesListPage />} />
        <Route caseSensitive path={ROUTES.DataSourcesNew} element={<NewDataSourcePage />} />
        <Route caseSensitive path={ROUTES.DataSourcesDetails} element={<DataSourceDetailsPage />} />
        <Route caseSensitive path={ROUTES.DataSourcesEdit} element={<EditDataSourcePage />} />
        <Route caseSensitive path={ROUTES.DataSourcesDashboards} element={<DataSourceDashboardsPage />} />

        {/* "Add new connection" page - we don't register a route in case a plugin already registers a standalone page for it */}
        {!isAddNewConnectionPageOverridden && (
          <Route caseSensitive path={ROUTES.AddNewConnection} element={<AddNewConnectionPage />} />
        )}

        {/* Redirect from earlier routes to updated routes */}
        <Route path={ROUTES.ConnectDataOutdated} element={<RedirectToAddNewConnection />} />
        <Route
          path={`${ROUTES.Base}/your-connections/:page`}
          element={<Navigate replace to={`${ROUTES.Base}/:page`} />}
        />
        <Route path={ROUTES.YourConnectionsOutdated} element={<Navigate replace to={ROUTES.DataSources} />} />

        {/* Not found */}
        <Route element={<Navigate replace to="/notfound" />} />
      </Routes>
    </DataSourcesRoutesContext.Provider>
  );
}
