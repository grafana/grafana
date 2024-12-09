import { useState } from 'react';

import { ConfirmModal, InlineField, RadioButtonGroup } from '@grafana/ui';

import { AzureQueryEditorFieldProps } from '../../types';

import { setBasicLogsQuery, setDashboardTime, setKustoQuery } from './setQueryValue';

export function LogsManagement({ query, onQueryChange: onChange }: AzureQueryEditorFieldProps) {
  const [basicLogsAckOpen, setBasicLogsAckOpen] = useState<boolean>(false);
  return (
    <>
      <ConfirmModal
        isOpen={basicLogsAckOpen}
        title="Basic Logs Queries"
        body="Are you sure you want to switch to Basic Logs?"
        description="Basic Logs queries incur cost based on the amount of data scanned."
        confirmText="Confirm"
        onConfirm={() => {
          setBasicLogsAckOpen(false);
          let updatedBasicLogsQuery = setBasicLogsQuery(query, true);
          // if basic logs selected, set dashboard time
          updatedBasicLogsQuery = setDashboardTime(updatedBasicLogsQuery, 'dashboard');
          onChange(setKustoQuery(updatedBasicLogsQuery, ''));
        }}
        onDismiss={() => {
          setBasicLogsAckOpen(false);
          onChange(setBasicLogsQuery(query, false));
        }}
        confirmButtonVariant="primary"
      />
      <InlineField label="Logs" tooltip={<span>Specifies whether to run a Basic or Analytics Logs query.</span>}>
        <RadioButtonGroup
          options={[
            { label: 'Analytics', value: false },
            { label: 'Basic', value: true },
          ]}
          value={query.azureLogAnalytics?.basicLogsQuery ?? false}
          size={'md'}
          onChange={(val) => {
            setBasicLogsAckOpen(val);
            if (!val) {
              const updatedBasicLogsQuery = setBasicLogsQuery(query, val);
              onChange(setKustoQuery(updatedBasicLogsQuery, ''));
            }
          }}
        />
      </InlineField>
    </>
  );
}
