import React, { FC } from 'react';

import { Alert } from '@grafana/ui';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { CloudReceiverForm } from './form/CloudReceiverForm';
import { GrafanaReceiverForm } from './form/GrafanaReceiverForm';

interface Props {
  receiverName: string;
  config: AlertManagerCortexConfig;
  alertManagerSourceName: string;
}

export const EditReceiverView: FC<Props> = ({ config, receiverName, alertManagerSourceName }) => {
  const receiver = config.alertmanager_config.receivers?.find(({ name }) => name === receiverName);
  if (!receiver) {
    return (
      <Alert severity="error" title="Receiver not found">
        Sorry, this receiver does not seem to exist.
      </Alert>
    );
  }

  if (alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME) {
    return <GrafanaReceiverForm config={config} alertManagerSourceName={alertManagerSourceName} existing={receiver} />;
  } else {
    return <CloudReceiverForm config={config} alertManagerSourceName={alertManagerSourceName} existing={receiver} />;
  }
};
