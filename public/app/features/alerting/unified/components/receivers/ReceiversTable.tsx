import { useStyles } from '@grafana/ui';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import React, { FC, useMemo } from 'react';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { getAlertTableStyles } from '../../styles/table';
import { extractReadableNotifierTypes } from '../../utils/receivers';
import { ActionButton } from '../rules/ActionButton';
import { ActionIcon } from '../rules/ActionIcon';
import { ReceiversSection } from './ReceiversSection';

interface Props {
  config: AlertManagerCortexConfig;
}

export const ReceiversTable: FC<Props> = ({ config }) => {
  const tableStyles = useStyles(getAlertTableStyles);

  const grafanaNotifiers = useUnifiedAlertingSelector((state) => state.grafanaNotifiers);

  const rows = useMemo(
    () =>
      config.alertmanager_config.receivers?.map((receiver) => ({
        name: receiver.name,
        types: extractReadableNotifierTypes(receiver, grafanaNotifiers.result ?? []),
      })) ?? [],
    [config, grafanaNotifiers.result]
  );

  return (
    <ReceiversSection
      title="Contact points"
      description="Define where the notifications will be sent to, for example email or Slack."
      addButtonLabel="New contact point"
    >
      <table className={tableStyles.table}>
        <colgroup>
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>Contact point name</th>
            <th>Type</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {!rows.length && (
            <tr className={tableStyles.evenRow}>
              <td colSpan={3}>No receivers defined.</td>
            </tr>
          )}
          {rows.map((receiver, idx) => (
            <tr key={receiver.name} className={idx % 2 === 0 ? tableStyles.evenRow : undefined}>
              <td>{receiver.name}</td>
              <td>{receiver.types.join(', ')}</td>
              <td className={tableStyles.actionsCell}>
                <ActionButton icon="pen">Edit</ActionButton>
                <ActionIcon tooltip="delete receiver" icon="trash-alt" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReceiversSection>
  );
};
