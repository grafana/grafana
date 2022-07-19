import * as React from 'react';
import { Route, Switch } from 'react-router-dom';

import { Page } from 'app/core/components/Page/Page';
import { DataSourcesRoutesContext } from 'app/features/datasources/state';

import { ROUTES } from './constants';
import { useNavModel } from './hooks/useNavModel';
import { CloudIntegrations } from './tabs/CloudIntegrations';
import { DataSources, DataSourcesNew, DataSourcesEdit } from './tabs/DataSources';
import { Plugins } from './tabs/Plugins';
import { RecordedQueries } from './tabs/RecordedQueries';

export default function DataConnectionsPage(): React.ReactElement | null {
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
            <Route path={ROUTES.DataSourcesNew} component={DataSourcesNew} />
            <Route path={ROUTES.DataSourcesEdit} component={DataSourcesEdit} />
            <Route path={ROUTES.DataSources} component={DataSources} />
            <Route path={ROUTES.Plugins} component={Plugins} />
            <Route path={ROUTES.CloudIntegrations} component={CloudIntegrations} />
            <Route path={ROUTES.RecordedQueries} component={RecordedQueries} />

            {/* Default page */}
            <Route component={DataSources} />
          </Switch>
        </Page.Contents>
      </Page>
    </DataSourcesRoutesContext.Provider>
  );
}
