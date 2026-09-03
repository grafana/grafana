import { useAsync } from 'react-use';

import { Trans } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { ColorCard, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { AdminSettingsTable } from './AdminSettingsTable';

export type Settings = { [key: string]: { [key: string]: string } };

function AdminSettings() {
  const { loading, value: settings } = useAsync(() => getBackendSrv().get<Settings>('/api/admin/settings'), []);

  return (
    <Page navId="server-settings">
      <Page.Contents>
        <Stack direction="column" gap={2}>
          <ColorCard variant="info" title="" size="sm">
            <ColorCard.Icon />
            <ColorCard.Title>Info</ColorCard.Title>
            <Trans i18nKey="admin.settings.info-description">
              These system settings are defined in grafana.ini or custom.ini (or overridden in ENV variables). To change
              these you currently need to restart Grafana.
            </Trans>
          </ColorCard>

          {loading && <AdminSettingsTable.Skeleton />}

          {settings && <AdminSettingsTable settings={settings} />}
        </Stack>
      </Page.Contents>
    </Page>
  );
}

export default AdminSettings;
