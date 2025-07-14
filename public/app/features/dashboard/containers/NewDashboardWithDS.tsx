import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { Trans } from '@grafana/i18n';
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { useDispatch } from 'app/types/store';

import { setInitialDatasource } from '../state/reducers';

export default function NewDashboardWithDS() {
  const [error, setError] = useState<string | null>(null);
  const { datasourceUid } = useParams();
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
          <div>
            <Trans i18nKey="dashboard.new-dashboard-with-ds.not-found">
              Data source with UID &quot;{{ datasourceUid }}&quot; not found.
            </Trans>
          </div>
        </Page.Contents>
      </Page>
    );
  }

  return null;
}
