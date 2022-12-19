import React, { useEffect, useState } from 'react';

import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { getNewDashboardModelData, setDashboardToFetchFromLocalStorage } from '../state/initDashboard';

export default function NewDashboardWithDS(props: GrafanaRouteComponentProps<{ datasourceUid: string }>) {
  const [error, setError] = useState<string | null>(null);
  const { datasourceUid } = props.match.params;

  useEffect(() => {
    const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
    if (!ds) {
      setError('Data source not found');
      return;
    }

    const newDashboard = getNewDashboardModelData();
    const { dashboard } = newDashboard;
    dashboard.panels[0] = {
      ...dashboard.panels[0],
      id: 1,
      type: 'timeseries',
      datasource: {
        uid: ds.uid,
        type: ds.type,
      },
    };

    setDashboardToFetchFromLocalStorage(newDashboard);
    locationService.push('/dashboard/new?editPanel=1');
  }, [datasourceUid]);

  if (error) {
    return (
      <Page navId="dashboards">
        <Page.Contents>Data source not found</Page.Contents>
      </Page>
    );
  }

  return null;
}
