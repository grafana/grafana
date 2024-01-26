import React, { useEffect, useState } from 'react';

import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { useDispatch } from 'app/types';

import { setInitialDatasource } from '../state/reducers';

export default function NewDashboardWithDS(props: GrafanaRouteComponentProps<{ datasourceUid: string }>) {
  const [error, setError] = useState<string | null>(null);
  const { datasourceUid } = props.match.params;
  const dispatch = useDispatch();

  useEffect(() => {
    const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
    if (!ds) {
      setError('Data source not found');
      return;
    }

    dispatch(setInitialDatasource(datasourceUid));

    locationService.replace('/dashboard/new');
  }, [datasourceUid, dispatch]);

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
