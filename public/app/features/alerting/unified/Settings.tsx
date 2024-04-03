import React from 'react';

import { LinkButton, Stack, Text } from '@grafana/ui';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { Spacer } from './components/Spacer';
import { useEditConfigurationDrawer } from './components/admin/ConfigurationDrawer';
import { ExternalAlertmanagers } from './components/admin/ExternalAlertmanagers';
import InternalAlertmanager from './components/admin/InternalAlertmanager';
import { SettingsProvider, useSettings } from './components/admin/SettingsContext';

// @todo translate subtitle – move to navtree?
const SUBTITLE =
  'Manage Alertmanger configurations and configure where alert instances generated from Grafana-managed alert rules are sent.';

export default function SettingsPage() {
  return (
    <SettingsProvider>
      <SettingsContent />
    </SettingsProvider>
  );
}

function SettingsContent() {
  const [configurationDrawer, showConfiguration] = useEditConfigurationDrawer();
  const { isLoading } = useSettings();

  return (
    <AlertingPageWrapper navId="alerting-admin" subTitle={SUBTITLE} isLoading={isLoading}>
      <Stack direction="column" gap={2}>
        {/* internal Alertmanager */}
        <Text variant="h5">Built-in Alertmanager</Text>
        <InternalAlertmanager onEditConfiguration={showConfiguration} />
        {/* external Alertmanagers (data sources) we have added to Grafana (vanilla, Mimir, Cortex) */}
        <Stack alignItems="center">
          <Text variant="h5">Other Alertmanagers</Text>
          <Spacer />
          <LinkButton href="/connections/datasources/alertmanager" icon="plus" variant="secondary">
            Add Alertmanager
          </LinkButton>
        </Stack>
        <ExternalAlertmanagers onEditConfiguration={showConfiguration} />
      </Stack>
      {configurationDrawer}
    </AlertingPageWrapper>
  );
}
