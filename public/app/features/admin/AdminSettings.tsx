import React from 'react';
import { useAsync } from 'react-use';

import { getBackendSrv } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';

import { AdminSettingsTable } from './AdminSettingsTable';

export type Settings = { [key: string]: { [key: string]: string } };

function AdminSettings() {
  const { loading, value: settings } = useAsync(() => getBackendSrv().get<Settings>('/api/admin/settings'), []);

  return (
    <Page navId="server-settings">
      <Page.Contents>
        <div className="grafana-info-box span8" style={{ margin: '20px 0 25px 0' }}>
          These system settings are defined in grafana.ini or custom.ini (or overridden in ENV variables). To change
          these you currently need to restart Grafana.
        </div>

        {loading && <AdminSettingsTable.Skeleton />}

        {settings && <AdminSettingsTable settings={settings} />}
      </Page.Contents>
    </Page>
  );
}

export default AdminSettings;
