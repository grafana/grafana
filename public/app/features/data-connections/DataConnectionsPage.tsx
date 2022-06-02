import * as React from 'react';
import { useSelector } from 'react-redux';
import { Route, Switch } from 'react-router-dom';

import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types/store';

import { ROUTES } from './constants';
import { CloudIntegrations } from './pages/CloudIntegrations';
import { DataSources } from './pages/DataSources';
import { Plugins } from './pages/Plugins';
import { RecordedQueries } from './pages/RecordedQueries';

export default function DataConnectionsPage(): React.ReactElement | null {
  const navModel = useSelector((state: StoreState) => getNavModel(state.navIndex, 'data-connections'));

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
