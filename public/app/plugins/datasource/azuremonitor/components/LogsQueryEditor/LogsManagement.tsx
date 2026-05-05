import { useState } from 'react';

import { t } from '@grafana/i18n';
import { ConfirmModal, InlineField, RadioButtonGroup } from '@grafana/ui';

import { type AzureQueryEditorFieldProps } from '../../types/types';

import { setBasicLogsQuery, setDashboardTime, setKustoQuery } from './setQueryValue';

interface LogsManagementProps extends AzureQueryEditorFieldProps {
  auxiliaryLogsEnabled?: boolean;
}

export function LogsManagement({ query, onQueryChange: onChange, auxiliaryLogsEnabled }: LogsManagementProps) {
  const [basicLogsAckOpen, setBasicLogsAckOpen] = useState<boolean>(false);

  const searchLogsLabel = auxiliaryLogsEnabled
    ? t('components.logs-management.label-basic-and-aux', 'Basic & Aux')
    : t('components.logs-management.label-basic', 'Basic');

  const modalTitle = auxiliaryLogsEnabled
    ? t('components.logs-management.title-basic-aux-logs-queries', 'Basic & Auxiliary Logs Queries')
    : t('components.logs-management.title-basic-logs-queries', 'Basic Logs Queries');

  const modalBody = auxiliaryLogsEnabled
    ? t(
        'components.logs-management.body-basic-aux-logs-queries',
        'Are you sure you want to switch to Basic & Auxiliary Logs?'
      )
    : t('components.logs-management.body-basic-logs-queries', 'Are you sure you want to switch to Basic Logs?');

  const modalDescription = auxiliaryLogsEnabled
    ? t(
        'components.logs-management.description-basic-aux-logs-queries',
        'Basic & Auxiliary Logs queries incur cost based on the amount of data scanned. Auxiliary logs have no response time SLAs and should not be used for dashboards requiring real-time data or for alerting.'
      )
    : t(
        'components.logs-management.description-basic-logs-queries',
        'Basic Logs queries incur cost based on the amount of data scanned.'
      );

  return (
    <>
      <ConfirmModal
        isOpen={basicLogsAckOpen}
        title={modalTitle}
        body={modalBody}
        description={modalDescription}
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
        tooltip={
          auxiliaryLogsEnabled
            ? t(
                'components.logs-management.tooltip-logs-aux',
                'Specifies whether to run a Basic & Auxiliary or Analytics Logs query.'
              )
            : t(
                'components.logs-management.tooltip-logs',
                'Specifies whether to run a Basic or Analytics Logs query.'
              )
        }
      >
        <RadioButtonGroup
          options={[
            { label: 'Analytics', value: false },
            { label: searchLogsLabel, value: true },
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
