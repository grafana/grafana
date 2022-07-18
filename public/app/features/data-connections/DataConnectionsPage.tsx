import * as React from 'react';
import { Route, Switch } from 'react-router-dom';

import { Page } from 'app/core/components/Page/Page';

import { ROUTES } from './constants';
import { useNavModel } from './hooks/useNavModel';
import { CloudIntegrations } from './tabs/CloudIntegrations';
import { DataSources } from './tabs/DataSources';
import { Plugins } from './tabs/Plugins';
import { RecordedQueries } from './tabs/RecordedQueries';

export default function DataConnectionsPage(): React.ReactElement | null {
  const navModel = useNavModel();

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <Switch>
          <Route path={ROUTES.DataSources} component={DataSources} />
          <Route path={ROUTES.DataSourcesNew} component={DataSources} />
          <Route path={ROUTES.DataSourcesEdit} component={DataSources} />
          <Route path={ROUTES.Plugins} component={Plugins} />
          <Route path={ROUTES.CloudIntegrations} component={CloudIntegrations} />
          <Route path={ROUTES.RecordedQueries} component={RecordedQueries} />

          {/* Default page */}
          <Route component={DataSources} />
        </Switch>
      </Page.Contents>
    </Page>
  );
}
