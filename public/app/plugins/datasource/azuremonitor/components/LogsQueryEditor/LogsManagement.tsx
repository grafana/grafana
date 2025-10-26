import { useState } from 'react';

import { t } from '@grafana/i18n';
import { ConfirmModal, InlineField, RadioButtonGroup } from '@grafana/ui';

import { AzureQueryEditorFieldProps } from '../../types/types';

import { setBasicLogsQuery, setDashboardTime, setKustoQuery } from './setQueryValue';

export function LogsManagement({ query, onQueryChange: onChange }: AzureQueryEditorFieldProps) {
  const [basicLogsAckOpen, setBasicLogsAckOpen] = useState<boolean>(false);

  return (
    <>
      <ConfirmModal
        isOpen={basicLogsAckOpen}
        title={t('components.logs-management.title-basic-logs-queries', 'Basic Logs Queries')}
        body={t('components.logs-management.body-basic-logs-queries', 'Are you sure you want to switch to Basic Logs?')}
        description={t(
          'components.logs-management.description-basic-logs-queries',
          'Basic Logs queries incur cost based on the amount of data scanned.'
        )}
        confirmText={t('components.logs-management.confirmText-confirm', 'Confirm')}
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
      <InlineField
        label={t('components.logs-management.label-logs', 'Logs')}
        tooltip={t(
          'components.logs-management.tooltip-logs',
          'Specifies whether to run a Basic or Analytics Logs query.'
        )}
      >
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
