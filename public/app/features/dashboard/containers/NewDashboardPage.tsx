import React, { useState } from 'react';
import { useEffectOnce } from 'react-use';

import { config } from '@grafana/runtime';
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
    <DatasourceOnboarding onNewDashboard={() => setCreateDashboard(true)} loading={loading} />
  );
}
