import * as React from 'react';
import { useSelector } from 'react-redux';
import { Route, Switch, useLocation } from 'react-router-dom';
import { createSelector } from 'reselect';

import { getActiveItem } from 'app/core/components/NavBar/utils';
import { Page } from 'app/core/components/Page/Page';
import { DataSourcesList } from 'app/features/datasources/components/DataSourcesList';
import { NewDataSource } from 'app/features/datasources/components/NewDataSource';
import { DataSourcesRoutesContext } from 'app/features/datasources/state';
import { StoreState } from 'app/types';

import { ROUTES } from './constants';
import { ConnectData } from './tabs/ConnectData';
import { DataSourcesEdit } from './tabs/DataSourcesEdit';

// TEMPRORARY
// Putting it in here until it turns out how the https://github.com/grafana/grafana/pull/56360 goes.
// --------------------------------------------------------------------
const selectNavId = createSelector(
  (state: StoreState) => state.navBarTree,
  (state: StoreState, pathname: string) => pathname,
  (navBarTree, pathname) => {
    // Falling back to use `navId` in case the page explicitly specifies it.
    // Otherwise just find the active item based on the current path.
    return getActiveItem(navBarTree, pathname)?.id || '';
  }
);
// --------------------------------------------------------------------

export default function ConnectionsPage() {
  const { pathname } = useLocation();
  const navId = useSelector((state: StoreState) => selectNavId(state, pathname));

  return (
    <DataSourcesRoutesContext.Provider
      value={{
        New: ROUTES.DataSourcesNew,
        List: ROUTES.DataSources,
        Edit: ROUTES.DataSourcesEdit,
        Dashboards: ROUTES.DataSourcesDashboards,
      }}
    >
      <Page navId={navId}>
        <Page.Contents>
          <Switch>
            <Route path={ROUTES.DataSourcesNew} component={NewDataSource} />
            <Route path={ROUTES.DataSourcesEdit} component={DataSourcesEdit} />
            <Route path={ROUTES.DataSources} component={DataSourcesList} />
            <Route path={ROUTES.ConnectData} component={ConnectData} />

            {/* Default page */}
            <Route component={DataSourcesList} />
          </Switch>
        </Page.Contents>
      </Page>
    </DataSourcesRoutesContext.Provider>
  );
}
