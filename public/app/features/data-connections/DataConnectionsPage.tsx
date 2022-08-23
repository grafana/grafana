import * as React from 'react';
import { Route, Switch } from 'react-router-dom';

import { Page } from 'app/core/components/Page/Page';
import { DataSourcesList } from 'app/features/datasources/components/DataSourcesList';
import { NewDataSource } from 'app/features/datasources/components/NewDataSource';
import { DataSourcesRoutesContext } from 'app/features/datasources/state';

import { ROUTES } from './constants';
import { useNavModel } from './hooks/useNavModel';
import { CloudIntegrations } from './tabs/CloudIntegrations';
import { DataSourcesEdit } from './tabs/DataSourcesEdit';
import { Plugins } from './tabs/Plugins';

export default function DataConnectionsPage() {
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
            <Route path={ROUTES.Plugins} component={Plugins} />
            <Route path={ROUTES.CloudIntegrations} component={CloudIntegrations} />

            {/* Default page */}
            <Route component={DataSourcesList} />
          </Switch>
        </Page.Contents>
      </Page>
    </DataSourcesRoutesContext.Provider>
  );
}
