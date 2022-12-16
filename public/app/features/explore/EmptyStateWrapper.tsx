import React, { useState } from 'react';
import { useEffectOnce } from 'react-use';

import { config } from '@grafana/runtime';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { EmptyStateNoDatasource } from 'app/features/datasources/components/EmptyStateNoDatasource';
import { ExploreQueryParams, useDispatch, useSelector } from 'app/types';

import { loadDataSources } from '../datasources/state';

import { ExplorePage } from './ExplorePage';

export default function NewDashboardPage(props: GrafanaRouteComponentProps<{}, ExploreQueryParams>) {
  const dispatch = useDispatch();
  useEffectOnce(() => {
    if (config.featureToggles.datasourceOnboarding) {
      dispatch(loadDataSources());
    }
  });

  const { hasDatasource, loading } = useSelector((state) => ({
    hasDatasource: state.dataSources.dataSourcesCount > 0,
    loading: !state.dataSources.hasFetched,
  }));
  const [showOnboarding, setShowOnboarding] = useState(config.featureToggles.datasourceOnboarding);
  const showExplorePage = hasDatasource || !showOnboarding;

  return showExplorePage ? (
    <ExplorePage {...props} />
  ) : (
    <EmptyStateNoDatasource
      onCTAClick={() => setShowOnboarding(false)}
      loading={loading}
      title="Welcome to Grafana Explore!"
      CTAText="Or explore sample data"
      navId="explore"
    />
  );
}
