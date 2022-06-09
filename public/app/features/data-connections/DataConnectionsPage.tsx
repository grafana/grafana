import * as React from 'react';
import { Route, Switch } from 'react-router-dom';

import { Page } from 'app/core/components/Page/Page';

import { ROUTES } from './constants';
import { useNavModel } from './hooks/useNavModel';
import { CloudIntegrations } from './pages/CloudIntegrations';
import { DataSources } from './pages/DataSources';
import { Plugins } from './pages/Plugins';
import { RecordedQueries } from './pages/RecordedQueries';

export default function DataConnectionsPage(): React.ReactElement | null {
  const navModel = useNavModel();

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <Switch>
          <Route exact path={ROUTES.Plugins} component={Plugins} />
          <Route exact path={ROUTES.CloudIntegrations} component={CloudIntegrations} />
          <Route exact path={ROUTES.RecordedQueries} component={RecordedQueries} />

          {/* Default page */}
          <Route component={DataSources} />
        </Switch>
      </Page.Contents>
    </Page>
  );
}
