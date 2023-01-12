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
      datasource: {
        uid: ds.uid,
        type: ds.type,
      },
    };

    setDashboardToFetchFromLocalStorage(newDashboard);
    locationService.replace('/dashboard/new');
  }, [datasourceUid]);

  if (error) {
    return (
      <Page navId="dashboards">
        <Page.Contents>
          <div>Data source with UID &quot;{datasourceUid}&quot; not found.</div>
        </Page.Contents>
      </Page>
    );
  }

  return null;
}
