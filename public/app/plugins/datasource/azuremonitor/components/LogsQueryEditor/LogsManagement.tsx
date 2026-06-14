import { useState } from 'react';

import { t } from '@grafana/i18n';
import { ConfirmModal, InlineField, RadioButtonGroup } from '@grafana/ui';

import { type AzureQueryEditorFieldProps } from '../../types/types';

import { setDashboardTime, setKustoQuery, setLogTier } from './setQueryValue';
import { getSelectedLogTier, type SelectedLogTier } from './utils';

interface LogsManagementProps extends AzureQueryEditorFieldProps {
  basicLogsEnabled?: boolean;
  auxiliaryLogsEnabled?: boolean;
}

type RadioValue = SelectedLogTier;
type PendingTier = 'Basic' | 'Auxiliary' | null;

export function LogsManagement({
  query,
  onQueryChange: onChange,
  basicLogsEnabled,
  auxiliaryLogsEnabled,
}: LogsManagementProps) {
  const [pendingTier, setPendingTier] = useState<PendingTier>(null);

  const selectedValue: RadioValue = getSelectedLogTier(query);

  const basicLabel = t('components.logs-management.label-basic', 'Basic');
  const auxLabel = t('components.logs-management.label-auxiliary', 'Auxiliary');
  const analyticsLabel = t('components.logs-management.label-analytics', 'Analytics');

  const options: Array<{ label: string; value: RadioValue }> = [{ label: analyticsLabel, value: 'Analytics' }];
  if (basicLogsEnabled) {
    options.push({ label: basicLabel, value: 'Basic' });
  }
  if (auxiliaryLogsEnabled) {
    options.push({ label: auxLabel, value: 'Auxiliary' });
  }

  const tooltip = buildTooltip(basicLogsEnabled, auxiliaryLogsEnabled);

  const isAuxPending = pendingTier === 'Auxiliary';
  const modalTitle = isAuxPending
    ? t('components.logs-management.title-auxiliary-logs-queries', 'Auxiliary Logs Queries')
    : t('components.logs-management.title-basic-logs-queries', 'Basic Logs Queries');
  const modalBody = isAuxPending
    ? t('components.logs-management.body-auxiliary-logs-queries', 'Are you sure you want to switch to Auxiliary Logs?')
    : t('components.logs-management.body-basic-logs-queries', 'Are you sure you want to switch to Basic Logs?');
  const modalDescription = isAuxPending
    ? t(
        'components.logs-management.description-auxiliary-logs-queries',
        'Auxiliary Logs queries incur cost based on the amount of data scanned. Auxiliary logs have no response time SLAs and should not be used for dashboards requiring real-time data or for alerting.'
      )
    : t(
        'components.logs-management.description-basic-logs-queries',
        'Basic Logs queries incur cost based on the amount of data scanned.'
      );

  const commitTier = (tier: 'Basic' | 'Auxiliary') => {
    let updated = setLogTier(query, tier);
    updated = setDashboardTime(updated, 'dashboard');
    onChange(setKustoQuery(updated, ''));
  };

  return (
    <>
      <ConfirmModal
        isOpen={pendingTier !== null}
        title={modalTitle}
        body={modalBody}
        description={modalDescription}
        confirmText={t('components.logs-management.confirmText-confirm', 'Confirm')}
        onConfirm={() => {
          if (pendingTier) {
            commitTier(pendingTier);
          }
          setPendingTier(null);
        }}
        onDismiss={() => {
          setPendingTier(null);
        }}
        confirmVariant="primary"
      />
      <InlineField label={t('components.logs-management.label-logs', 'Logs')} tooltip={tooltip}>
        <RadioButtonGroup<RadioValue>
          options={options}
          value={selectedValue}
          size={'md'}
          onChange={(val) => {
            if (val === selectedValue) {
              return;
            }
            if (val === 'Analytics') {
              const cleared = setLogTier(query, undefined);
              onChange(setKustoQuery(cleared, ''));
              return;
            }
            setPendingTier(val);
          }}
        />
      </InlineField>
    </>
  );
}

function buildTooltip(basicLogsEnabled?: boolean, auxiliaryLogsEnabled?: boolean): string {
  if (basicLogsEnabled && auxiliaryLogsEnabled) {
    return t(
      'components.logs-management.tooltip-logs-all',
      'Specifies whether to run an Analytics, Basic, or Auxiliary Logs query.'
    );
  }
  if (auxiliaryLogsEnabled) {
    return t(
      'components.logs-management.tooltip-logs-aux',
      'Specifies whether to run an Analytics or Auxiliary Logs query.'
    );
  }
  return t('components.logs-management.tooltip-logs', 'Specifies whether to run a Basic or Analytics Logs query.');
}
