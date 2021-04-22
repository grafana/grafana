import { InfoBox } from '@grafana/ui';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import React, { FC } from 'react';

interface Props {
  receiverName: string;
  config: AlertManagerCortexConfig;
  alertManagerSourceName: string;
}

export const EditReceiverView: FC<Props> = ({ config, receiverName, alertManagerSourceName }) => {
  const receiver = config.alertmanager_config.receivers?.find(({ name }) => name === receiverName);
  if (!receiver) {
    return (
      <InfoBox severity="error" title="Receiver not found">
        Sorry, this receiver does not seem to exit.
      </InfoBox>
    );
  }
  return (
    <pre>
      {alertManagerSourceName} {JSON.stringify(receiver, null, 2)}
    </pre>
  );
};
