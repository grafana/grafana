import React, { useState } from 'react';

import { config } from '@grafana/runtime';
import { t } from 'app/core/internationalization';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { EmptyStateNoDatasource } from 'app/features/datasources/components/EmptyStateNoDatasource';
import { useLoadDataSources } from 'app/features/datasources/state';
import { useSelector } from 'app/types';

import DashboardPage from './DashboardPage';

export default function NewDashboardPage(props: GrafanaRouteComponentProps) {
  const { isLoading } = useLoadDataSources();

  const { hasDatasource } = useSelector((state) => ({
    hasDatasource: state.dataSources.dataSourcesCount > 0,
  }));
  const [createDashboard, setCreateDashboard] = useState(false);
  const showDashboardPage = hasDatasource || createDashboard || !config.featureToggles.datasourceOnboarding;

  return showDashboardPage ? (
    <DashboardPage {...props} />
  ) : (
    <EmptyStateNoDatasource
      onCTAClick={() => setCreateDashboard(true)}
      loading={isLoading}
      title={t('datasource-onboarding.welcome', 'Welcome to Grafana dashboards!')}
      CTAText={t('datasource-onboarding.sampleData', 'Or set up a new dashboard with sample data')}
      navId="dashboards/browse"
      pageNav={{ text: t('datasource-onboarding.new-dashboard', 'New dashboard'), url: '/dashboard/new' }}
    />
  );
}
