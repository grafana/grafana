import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import React, { FC } from 'react';
import { GrafanaReceiverForm } from './ReceiverForm';

interface Props {
  config: AlertManagerCortexConfig;
  alertManagerSourceName: string;
}

export const NewReceiverView: FC<Props> = ({ alertManagerSourceName }) => {
  return <GrafanaReceiverForm alertManagerSourceName={alertManagerSourceName} />;
};
