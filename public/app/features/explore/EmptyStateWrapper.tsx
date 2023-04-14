import React, { useState } from 'react';

import { config } from '@grafana/runtime';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { EmptyStateNoDatasource } from 'app/features/datasources/components/EmptyStateNoDatasource';
import { ExploreQueryParams, useSelector } from 'app/types';

import { useLoadDataSources } from '../datasources/state';

import { ExplorePage } from './ExplorePage';

export default function EmptyStateWrapper(props: GrafanaRouteComponentProps<{}, ExploreQueryParams>) {
  const { isLoading } = useLoadDataSources();

  const { hasDatasource } = useSelector((state) => ({
    hasDatasource: state.dataSources.dataSourcesCount > 0,
  }));
  const [showOnboarding, setShowOnboarding] = useState(config.featureToggles.datasourceOnboarding);
  const showExplorePage = hasDatasource || !showOnboarding;

  return showExplorePage ? (
    <ExplorePage {...props} />
  ) : (
    <EmptyStateNoDatasource
      onCTAClick={() => setShowOnboarding(false)}
      loading={isLoading}
      title="Welcome to Grafana Explore!"
      CTAText="Or explore sample data"
      navId="explore"
    />
  );
}
