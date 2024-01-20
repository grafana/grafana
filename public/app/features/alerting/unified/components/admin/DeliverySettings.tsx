import React from 'react';

import { SelectableValue } from '@grafana/data';
import { Field, RadioButtonGroup, Stack, Text } from '@grafana/ui';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { NeedHelpInfo } from '../rule-editor/NeedHelpInfo';

const ALERTMANAGER_DELIVERY_OPTIONS: Array<SelectableValue<AlertmanagerChoice>> = [
  { value: AlertmanagerChoice.Internal, label: 'Only Internal' },
  { value: AlertmanagerChoice.External, label: 'Only External' },
  { value: AlertmanagerChoice.All, label: 'Both internal and external' },
];

export default function DeliverySettings() {
  const { currentData: deliverySettings } = alertmanagerApi.endpoints.getExternalAlertmanagerConfig.useQuery();
  const [saveExternalAlertManagers] = alertmanagerApi.endpoints.saveExternalAlertmanagersConfig.useMutation();

  const alertmanagersChoice = deliverySettings?.alertmanagersChoice;

  const handleUpdateAlertmanagerChoice = (alertmanagersChoice: AlertmanagerChoice) => {
    saveExternalAlertManagers({ alertmanagersChoice });
  };

  return (
    <>
      <Stack direction="column" gap={0.5}>
        <Text variant="h4">Send Grafana-managed alerts to</Text>
        <Text color="secondary">
          Configure where alert instances generated from Grafana-managed alert rules are sent.
        </Text>
      </Stack>

      <Stack direction="column" gap={0}>
        <Field>
          <RadioButtonGroup
            options={ALERTMANAGER_DELIVERY_OPTIONS}
            value={alertmanagersChoice}
            onChange={handleUpdateAlertmanagerChoice}
          />
        </Field>
        <Stack direction="row" gap={1}>
          <Text color="secondary">Instances are sent to the Grafana built-in alertmanager.</Text>
          <NeedHelpInfo contentText={'some text here please replace me'} title={'Need help?'} />
        </Stack>
      </Stack>
    </>
  );
}
