// Libraries
import React, { useEffect } from 'react';

import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { getDashboardLoader } from './DashboardsLoader';

export interface Props extends GrafanaRouteComponentProps<{ uid: string }> {}

export const DashboardScenePage = ({ match }: Props) => {
  const loader = getDashboardLoader();
  const { dashboard, isLoading } = loader.useState();

  useEffect(() => {
    loader.load(match.params.uid);
  }, [loader, match.params.uid]);

  if (!dashboard) {
    return (
      <Page navId="dashboards/browse">
        {isLoading && <PageLoader />}
        {!isLoading && <h2>Dashboard not found</h2>}
      </Page>
    );
  }

  return <dashboard.Component model={dashboard} />;
};

export default DashboardScenePage;
