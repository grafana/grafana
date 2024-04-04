import React from 'react';

import { LinkButton, Stack, Text } from '@grafana/ui';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { WithReturnButton } from './components/WithReturnButton';
import { useEditConfigurationDrawer } from './components/settings/ConfigurationDrawer';
import { ExternalAlertmanagers } from './components/settings/ExternalAlertmanagers';
import InternalAlertmanager from './components/settings/InternalAlertmanager';
import { SettingsProvider, useSettings } from './components/settings/SettingsContext';

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
    <AlertingPageWrapper
      navId="alerting-admin"
      subTitle={SUBTITLE}
      isLoading={isLoading}
      actions={[
        <WithReturnButton
          key="add-alertmanager"
          title="Alerting settings"
          component={
            <LinkButton href="/connections/datasources/alertmanager" icon="plus" variant="primary">
              Add new Alertmanager
            </LinkButton>
          }
        />,
      ]}
    >
      <Stack direction="column" gap={2}>
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
