import React, { useCallback, useMemo, useState } from 'react';

import { Drawer, Stack, Text } from '@grafana/ui';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import AlertmanagerConfig from './components/admin/AlertmanagerConfig';
import { ExternalAlertmanagers } from './components/admin/ExternalAlertmanagers';
import InternalAlertmanager from './components/admin/InternalAlertmanager';

// @todo translate subtitle – move to navtree?
const SUBTITLE =
  'Manage Alertmanger configurations and configure where alert instances generated from Grafana-managed alert rules are sent.';

export default function SettingsPage() {
  const [configurationDrawer, showConfiguration] = useEditConfigurationDrawer();

  return (
    <AlertingPageWrapper navId="alerting-admin" subTitle={SUBTITLE}>
      <Stack direction="column" gap={3}>
        {/* internal Alertmanager */}
        <Text variant="h5">Built-in Alertmanager</Text>
        <InternalAlertmanager onEditConfiguration={showConfiguration} />
        {/* external Alertmanagers (data sources) we have added to Grafana (vanilla, Mimir, Cortex) */}
        <Text variant="h5">Other Alertmanagers</Text>
        <ExternalAlertmanagers onEditConfiguration={showConfiguration} />
      </Stack>
      {configurationDrawer}
    </AlertingPageWrapper>
  );
}

// @TODO move to another file
function useEditConfigurationDrawer(): [React.ReactNode, () => void, () => void] {
  const [open, setOpen] = useState(false);

  const showConfiguration = useCallback(() => {
    setOpen(true);
  }, []);

  const dismissConfiguration = useCallback(() => {
    setOpen(false);
  }, []);

  const drawer = useMemo(() => {
    if (!open) {
      return null;
    }

    // @todo check copy
    return (
      <Drawer
        onClose={dismissConfiguration}
        title="Alertmanager name here"
        subtitle="This is the Alertmanager configuration"
        size="lg"
      >
        <AlertmanagerConfig alertmanagerName={'grafana'} onDismiss={dismissConfiguration} />
      </Drawer>
    );
  }, [dismissConfiguration, open]);

  return [drawer, showConfiguration, dismissConfiguration];
}
