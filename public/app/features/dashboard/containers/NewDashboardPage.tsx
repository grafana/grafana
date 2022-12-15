import React, { useState } from 'react';
import { useEffectOnce } from 'react-use';

import { config } from '@grafana/runtime';
import { t } from 'app/core/internationalization';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { loadDataSources } from 'app/features/datasources/state';
import { useDispatch, useSelector } from 'app/types';

import DashboardPage from './DashboardPage';
import { DatasourceOnboarding } from './DatasourceOnboarding';

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
    <DatasourceOnboarding
      onCTAClick={() => setCreateDashboard(true)}
      loading={loading}
      title={t('datasource-onboarding.welcome', 'Welcome to Grafana dashboards!')}
      CTAText={t('datasource-onboarding.sampleData', 'Or set up a new dashboard with sample data')}
      navId="dashboards/browse"
      pageNav={{ text: t('dashboard', 'New dashboard'), url: '/dashboard/new' }}
    />
  );
}
