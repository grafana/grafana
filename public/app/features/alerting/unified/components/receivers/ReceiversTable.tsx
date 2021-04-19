import { useStyles } from '@grafana/ui';
import { receiverTypeNames } from 'app/plugins/datasource/alertmanager/consts';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { capitalize } from 'lodash';
import React, { FC, useMemo } from 'react';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { getAlertTableStyles } from '../../styles/table';
import { ActionButton } from '../rules/ActionButton';
import { ActionIcon } from '../rules/ActionIcon';
import { ReceiversSection } from './ReceiversSection';

interface Props {
  config: AlertManagerCortexConfig;
}

export const ReceiversTable: FC<Props> = ({ config }) => {
  const tableStyles = useStyles(getAlertTableStyles);

  const grafanaReceiverTypes = useUnifiedAlertingSelector((state) => state.grafanaReceiverTypes);

  const receivers = useMemo(
    () =>
      config.alertmanager_config.receivers?.map((receiver) => ({
        name: receiver.name,
        types: [
          ...(receiver.grafana_managed_receiver_configs?.map((recv) => recv.type) ?? []).map(
            (type) => grafanaReceiverTypes.result?.find((r) => r.type === type)?.name ?? capitalize(type)
          ),
          ...Object.entries(receiver)
            .filter(
              ([key, value]) =>
                key !== 'grafana_managed_receiver_configs' &&
                key.endsWith('_configs') &&
                Array.isArray(value) &&
                !!value.length
            )
            .map(([key]) => key.replace('_configs', ''))
            .map((type) => receiverTypeNames[type] ?? capitalize(type)),
        ],
      })) ?? [],
    [config, grafanaReceiverTypes.result]
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
          {!receivers.length && (
            <tr className={tableStyles.evenRow}>
              <td colSpan={3}>No receivers defined.</td>
            </tr>
          )}
          {receivers.map((receiver, idx) => (
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
