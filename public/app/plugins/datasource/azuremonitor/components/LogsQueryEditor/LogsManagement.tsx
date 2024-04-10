import React, { useState } from 'react';

import { ConfirmModal, InlineField, RadioButtonGroup } from '@grafana/ui';

import { AzureQueryEditorFieldProps } from '../../types';

import { setBasicLogsQuery, setBasicLogsQueryAcknowledged, setKustoQuery } from './setQueryValue';

export function LogsManagement({ query, onQueryChange: onChange }: AzureQueryEditorFieldProps) {
  const [basicLogsAckOpen, setBasicLogsAckOpen] = useState<boolean>(false);
  return (
    <>
      <ConfirmModal
        isOpen={basicLogsAckOpen}
        title="Basic Logs Queries"
        body="Are you sure you want to switch to Basic Logs?"
        description="Basic Logs queries incur cost based on the amount of data scanned. Please acknowledge this panel is subject to per-query costs."
        confirmText="I Acknowledge"
        onConfirm={() => {
          setBasicLogsAckOpen(false);
          onChange(setBasicLogsQueryAcknowledged(query, true));
        }}
        onDismiss={() => {
          setBasicLogsAckOpen(false);
          const newQuery = setBasicLogsQuery(query, false);
          onChange(setBasicLogsQueryAcknowledged(newQuery, false));
        }}
        confirmButtonVariant="primary"
      />
      <InlineField label="Logs" tooltip={<span>Specifies whether to run a Basic or Analytics Logs query.</span>}>
        <>
          <RadioButtonGroup
            options={[
              { label: 'Analytics', value: false },
              { label: 'Basic', value: true },
            ]}
            value={query.azureLogAnalytics?.basicLogsQuery ?? false}
            size={'md'}
            onChange={(val) => {
              const updatedBasicLogsQuery = setBasicLogsQuery(query, val);
              onChange(setKustoQuery(updatedBasicLogsQuery, ''));
              setBasicLogsAckOpen(val);
            }}
          />
        </>
      </InlineField>
    </>
  );
}
