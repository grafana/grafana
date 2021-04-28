import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import React, { FC } from 'react';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { GrafanaReceiverForm } from './form/GrafanaReceiverForm';

interface Props {
  config: AlertManagerCortexConfig;
  alertManagerSourceName: string;
}

export const NewReceiverView: FC<Props> = ({ alertManagerSourceName, config }) => {
  if (alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME) {
    return <GrafanaReceiverForm alertManagerSourceName={alertManagerSourceName} config={config} />;
  } else {
    return <p>@TODO cloud receiver editing not implemented yet</p>;
  }
};
