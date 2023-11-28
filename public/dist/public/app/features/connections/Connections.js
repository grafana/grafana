import * as React from 'react';
import { Redirect, Route, Switch, useLocation } from 'react-router-dom';
import { DataSourcesRoutesContext } from 'app/features/datasources/state';
import { useSelector } from 'app/types';
import { ROUTES } from './constants';
import { AddNewConnectionPage, DataSourceDashboardsPage, DataSourceDetailsPage, DataSourcesListPage, EditDataSourcePage, NewDataSourcePage, } from './pages';
function RedirectToAddNewConnection() {
    const { search } = useLocation();
    return (React.createElement(Redirect, { to: {
            pathname: ROUTES.AddNewConnection,
            search,
        } }));
}
export default function Connections() {
    const navIndex = useSelector((state) => state.navIndex);
    const isAddNewConnectionPageOverridden = Boolean(navIndex['standalone-plugin-page-/connections/add-new-connection']);
    return (React.createElement(DataSourcesRoutesContext.Provider, { value: {
            New: ROUTES.DataSourcesNew,
            List: ROUTES.DataSources,
            Edit: ROUTES.DataSourcesEdit,
            Dashboards: ROUTES.DataSourcesDashboards,
        } },
        React.createElement(Switch, null,
            React.createElement(Route, { exact: true, sensitive: true, path: ROUTES.Base, component: () => React.createElement(Redirect, { to: ROUTES.AddNewConnection }) }),
            React.createElement(Route, { exact: true, sensitive: true, path: ROUTES.DataSources, component: DataSourcesListPage }),
            React.createElement(Route, { exact: true, sensitive: true, path: ROUTES.DataSourcesNew, component: NewDataSourcePage }),
            React.createElement(Route, { exact: true, sensitive: true, path: ROUTES.DataSourcesDetails, component: DataSourceDetailsPage }),
            React.createElement(Route, { exact: true, sensitive: true, path: ROUTES.DataSourcesEdit, component: EditDataSourcePage }),
            React.createElement(Route, { exact: true, sensitive: true, path: ROUTES.DataSourcesDashboards, component: DataSourceDashboardsPage }),
            !isAddNewConnectionPageOverridden && (React.createElement(Route, { exact: true, sensitive: true, path: ROUTES.AddNewConnection, component: AddNewConnectionPage })),
            React.createElement(Route, { exact: true, path: ROUTES.ConnectDataOutdated, component: RedirectToAddNewConnection }),
            React.createElement(Redirect, { from: `${ROUTES.Base}/your-connections/:page`, to: `${ROUTES.Base}/:page` }),
            React.createElement(Redirect, { from: ROUTES.YourConnectionsOutdated, to: ROUTES.DataSources }),
            React.createElement(Route, { component: () => React.createElement(Redirect, { to: "/notfound" }) }))));
}
//# sourceMappingURL=Connections.js.map