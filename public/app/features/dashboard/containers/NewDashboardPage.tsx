import React, { useState } from 'react';
import { useEffectOnce } from 'react-use';

import { config } from '@grafana/runtime';
import { t } from 'app/core/internationalization';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { EmptyStateNoDatasource } from 'app/features/datasources/components/EmptyStateNoDatasource';
import { loadDataSources } from 'app/features/datasources/state';
import { useDispatch, useSelector } from 'app/types';

import DashboardPage from './DashboardPage';

export default function NewDashboardPage(props: GrafanaRouteComponentProps) {
  const dispatch = useDispatch();
  useEffectOnce(() => {
    dispatch(loadDataSources());
  });

  const { hasDatasource, loading } = useSelector((state) => ({
    hasDatasource: state.dataSources.dataSourcesCount > 0,
    loading: !state.dataSources.hasFetched,
  }));
  const [createDashboard, setCreateDashboard] = useState(false);
  const showDashboardPage = hasDatasource || createDashboard || !config.featureToggles.datasourceOnboarding;

  return showDashboardPage ? (
    <DashboardPage {...props} />
  ) : (
    <EmptyStateNoDatasource
      onCTAClick={() => setCreateDashboard(true)}
      loading={loading}
      title={t('datasource-onboarding.welcome', 'Welcome to Grafana dashboards!')}
      CTAText={t('datasource-onboarding.sampleData', 'Or set up a new dashboard with sample data')}
      navId="dashboards/browse"
      pageNav={{ text: t('datasource-onboarding.new-dashboard', 'New dashboard'), url: '/dashboard/new' }}
    />
  );
}
