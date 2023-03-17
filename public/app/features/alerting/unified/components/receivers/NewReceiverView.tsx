import React from 'react';

import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { CloudReceiverForm } from './form/CloudReceiverForm';
import { GrafanaReceiverForm } from './form/GrafanaReceiverForm';

interface Props {
  config: AlertManagerCortexConfig;
  alertManagerSourceName: string;
}

export const NewReceiverView = ({ alertManagerSourceName, config }: Props) => {
  if (alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME) {
    return <GrafanaReceiverForm alertManagerSourceName={alertManagerSourceName} config={config} />;
  } else {
    return <CloudReceiverForm alertManagerSourceName={alertManagerSourceName} config={config} />;
  }
};
