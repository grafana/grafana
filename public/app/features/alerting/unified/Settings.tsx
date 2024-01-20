import React from 'react';

import { Button, Stack, Text } from '@grafana/ui';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { Spacer } from './components/Spacer';
import DeliverySettings from './components/admin/DeliverySettings';
import { ExternalAlertmanagers } from './components/admin/ExternalAlertmanagers';
import InternalAlertmanager from './components/admin/InternalAlertmanager';

export default function SettingsPage() {
  return (
    // @todo translate subtitle – move to navtree?
    <AlertingPageWrapper navId="alerting-admin" subTitle="Configure alertmanagers for Grafana-managed alert rules.">
      <Stack direction="column" gap={3}>
        {/* this is the built-in Alertmanager configuration where we can choose where to send alert for Grafana-managed alert rules */}
        <DeliverySettings />
        {/* this is where the configuration for alertmanagers is managed */}
        <AlertmanagerConfigurations />
      </Stack>
    </AlertingPageWrapper>
  );
}

function AlertmanagerConfigurations() {
  return (
    <>
      <Stack direction="column" gap={0.5}>
        <Text variant="h4">Available alertmanagers which can receive Grafana-managed alerts</Text>
        <Text color="secondary">
          Alertmanager data sources support a configuration setting that allows you to choose to send Grafana-managed
          alerts to that Alertmanager. Below, you can see the list of all Alertmanager data sources that have this
          setting enabled.
        </Text>
      </Stack>
      {/* this is the config part for the internal Alertmanager */}
      <Text variant="h5">Built-in Alertmanager</Text>
      <InternalAlertmanager />
      {/* {/* this is the config part for the external Alertmanagers (data sources) we have added to Grafana */}
      <Stack direction="row" alignItems="center">
        <Text variant="h5">Data source Alertmanagers</Text>
        <Spacer />
        <Button icon="plus" variant="secondary">
          Add Alertmanager
        </Button>
      </Stack>
      <ExternalAlertmanagers />
    </>
  );
}
