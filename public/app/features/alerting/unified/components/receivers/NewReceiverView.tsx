import React from 'react';

import {
  AlertManagerCortexConfig,
  GrafanaManagedReceiverConfig,
  Receiver,
} from 'app/plugins/datasource/alertmanager/types';

import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { CloudReceiverForm } from './form/CloudReceiverForm';
import { GrafanaReceiverForm } from './form/GrafanaReceiverForm';

interface Props {
  config: AlertManagerCortexConfig;
  alertManagerSourceName: string;
}

export const NewReceiverView = ({ alertManagerSourceName, config }: Props) => {
  const [searchParams] = useURLSearchParams();

  const name = searchParams.get('name');
  const type = searchParams.get('type');
  const webhookUrl = searchParams.get('settings.url');

  let prefill: Receiver | undefined = undefined;

  // So far, we only support oncall receivers
  if (name && type === 'oncall' && webhookUrl) {
    const webhookConfig: GrafanaManagedReceiverConfig = {
      name: name,
      type: 'webhook', // In the future, there might be a tailor-made oncall receiver
      disableResolveMessage: false,
      settings: {
        url: webhookUrl,
        httpMethod: 'POST',
      },
    };

    prefill = {
      name: name,
      grafana_managed_receiver_configs: [webhookConfig],
    };
  }

  if (alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME) {
    return <GrafanaReceiverForm alertManagerSourceName={alertManagerSourceName} config={config} prefill={prefill} />;
  } else {
    return <CloudReceiverForm alertManagerSourceName={alertManagerSourceName} config={config} />;
  }
};
