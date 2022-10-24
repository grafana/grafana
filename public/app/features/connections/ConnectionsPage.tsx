import * as React from 'react';
import { Route, Switch } from 'react-router-dom';

import { Page } from 'app/core/components/Page/Page';
import { DataSourcesList } from 'app/features/datasources/components/DataSourcesList';
import { NewDataSource } from 'app/features/datasources/components/NewDataSource';
import { DataSourcesRoutesContext } from 'app/features/datasources/state';

import { ROUTES } from './constants';
import { useNavModel } from './hooks/useNavModel';
import { ConnectData } from './tabs/ConnectData';
import { DataSourcesEdit } from './tabs/DataSourcesEdit';

export default function ConnectionsPage() {
  const navModel = useNavModel();

  return (
    <DataSourcesRoutesContext.Provider
      value={{
        New: ROUTES.DataSourcesNew,
        List: ROUTES.DataSources,
        Edit: ROUTES.DataSourcesEdit,
        Dashboards: ROUTES.DataSourcesDashboards,
      }}
    >
      <Page navModel={navModel}>
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
