import { useEffect } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { Page } from 'app/core/components/Page/Page';
import { useDispatch } from 'app/types/store';

import { setInitialDatasource } from '../state/reducers';

export default function NewDashboardWithDS() {
  const { datasourceUid } = useParams();
  const dispatch = useDispatch();
  const { isLoading, settings } = useDataSourceInstanceSettings(datasourceUid);

  useEffect(() => {
    if (isLoading || !settings) {
      return;
    }

    dispatch(setInitialDatasource(datasourceUid));

    locationService.replace('/dashboard/new');
  }, [datasourceUid, dispatch, isLoading, settings]);

  if (isLoading) {
    return null;
  }

  if (!settings) {
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
