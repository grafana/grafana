import produce from 'immer';
import { useCallback, useMemo } from 'react';

import { Receiver } from '../../../../../../../plugins/datasource/alertmanager/types';
import { NotifierDTO } from '../../../../../../../types';
import { alertmanagerApi } from '../../../../api/alertmanagerApi';
import { onCallApi, OnCallIntegration } from '../../../../api/onCallApi';
import { usePluginBridge } from '../../../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../../../types/pluginBridges';
import { option } from '../../../../utils/notifier-types';
import { GRAFANA_APP_RECEIVERS_SOURCE_IMAGE } from '../types';

const GRAFANA_INTEGRATION_TYPE = 'grafana';

export function useOnCallIntegration() {
  const { installed: isOnCallEnabled, loading: isPluginBridgeLoading } = usePluginBridge(SupportedPlugin.OnCall);

  const { useCreateIntegrationMutation, useGetOnCallIntegrationsQuery } = onCallApi;

  const [createIntegrationMutation] = useCreateIntegrationMutation();

  const { data: onCallIntegrations = [], isLoading: isLoadingOnCallIntegrations } = useGetOnCallIntegrationsQuery(
    undefined,
    { skip: !isOnCallEnabled }
  );

  const { useGrafanaNotifiersQuery } = alertmanagerApi;
  const { data: grafanaNotifiers = [], isLoading: isLoadingNotifiers } = useGrafanaNotifiersQuery(undefined, {
    skip: !isOnCallEnabled,
  });

  const grafanaOnCallIntegrations = useMemo(() => {
    return onCallIntegrations.filter((i) => i.integration === GRAFANA_INTEGRATION_TYPE);
  }, [onCallIntegrations]);

  const onCallNotifier = useOnCallNotifier(grafanaOnCallIntegrations, grafanaNotifiers);

  const onCallFormValidators = useMemo(
    () => ({
      integration_name: (value: string) => {
        return grafanaOnCallIntegrations.map((i) => i.verbal_name).includes(value)
          ? 'Integration of this name already exists in OnCall'
          : true;
      },
      oncall_url: (value: string) => {
        return grafanaOnCallIntegrations.map((i) => i.integration_url).includes(value)
          ? true
          : 'Selection of existing OnCall integration is required';
      },
    }),
    [grafanaOnCallIntegrations]
  );

  const mapWebhookReceiversToOnCalls = useCallback(
    (receiver: Receiver): Receiver => {
      if (!isOnCallEnabled) {
        return receiver;
      }

      const integrationUrls = grafanaOnCallIntegrations.map((integration) => integration.integration_url);

      return {
        ...receiver,
        grafana_managed_receiver_configs: receiver.grafana_managed_receiver_configs?.map((config) => {
          if (config.type === 'webhook' && integrationUrls.includes(config.settings['url'])) {
            return {
              ...config,
              type: 'oncall',
              settings: {
                ...config.settings,
                integration_type: 'existing_oncall_integration',
                oncall_url: config.settings['url'],
                url: undefined,
              },
            };
          }
          return config;
        }),
      };
    },
    [grafanaOnCallIntegrations, isOnCallEnabled]
  );

  const mapOnCallReceiversToWebhooks = useCallback(
    async (receiver: Receiver): Promise<Receiver> => {
      if (!isOnCallEnabled) {
        return receiver;
      }

      const onCallIntegrations = receiver.grafana_managed_receiver_configs?.filter((c) => c.type === 'oncall') ?? [];
      const newOnCallIntegrations = onCallIntegrations.filter(
        (c) => c.settings['integration_type'] === 'new_oncall_integration'
      );

      const createNewOnCallIntegrationJobs = newOnCallIntegrations.map(async (c) => {
        const newIntegration = await createIntegrationMutation({
          integration: GRAFANA_INTEGRATION_TYPE,
          verbal_name: c.settings['integration_name'],
        }).unwrap();
        c.type = 'webhook';
        c.settings['url'] = newIntegration.integration_url;
      });

      await Promise.all(createNewOnCallIntegrationJobs);

      return produce(receiver, (draft) => {
        draft.grafana_managed_receiver_configs?.forEach((c) => {
          if (c.type === 'oncall') {
            c.type = 'webhook';
            c.settings['url'] = c.settings['oncall_url'];
            delete c.settings['oncall_url'];
            delete c.settings['integration_type'];
          }
        });
      });
    },
    [isOnCallEnabled, createIntegrationMutation]
  );

  return {
    onCallNotifier: {
      dto: onCallNotifier,
      meta: {
        enabled: isOnCallEnabled,
        order: 1,
        description: 'Connect effortlessly to Grafana OnCall',
        iconUrl: GRAFANA_APP_RECEIVERS_SOURCE_IMAGE[SupportedPlugin.OnCall],
      },
    },
    onCallFormValidators,
    mapWebhookReceiversToOnCalls,
    mapOnCallReceiversToWebhooks,
    isLoadingOnCallIntegration: isLoadingOnCallIntegrations || isLoadingNotifiers || isPluginBridgeLoading,
  };
}

function useOnCallNotifier(onCallIntegrations: OnCallIntegration[], notifiers: NotifierDTO[]) {
  return useMemo<NotifierDTO>(() => {
    const webhookReceiver = notifiers.find((n) => n.type === 'webhook');
    const webhookOptions = webhookReceiver?.options.filter((o) => o.propertyName !== 'url') ?? [];

    return {
      name: 'Grafana OnCall',
      type: 'oncall',
      description: 'Grafana OnCall contact point',
      heading: 'Grafana OnCall',
      info: '',
      options: [
        option('integration_type', 'How to connect to OnCall', '', {
          required: true,
          element: 'radio',
          selectOptions: [
            {
              value: 'new_oncall_integration',
              label: 'New OnCall integration',
              description: 'A new OnCall integration without escalation chains will be automatically created',
            },
            {
              value: 'existing_oncall_integration',
              label: 'Existing OnCall integration',
              description: 'Use an existing OnCall integration',
            },
          ],
        }),
        option('integration_name', 'Integration name', 'The name of the new OnCall integration', {
          required: true,
          showWhen: { field: 'integration_type', is: 'new_oncall_integration' },
        }),
        option('oncall_url', 'OnCall Integration', 'The OnCall integration to send alerts to', {
          element: 'select',
          required: true,
          showWhen: { field: 'integration_type', is: 'existing_oncall_integration' },
          selectOptions: onCallIntegrations.map((i) => ({
            label: i.verbal_name,
            description: i.integration_url,
            value: i.integration_url,
          })),
        }),
        ...webhookOptions,
      ],
    };
  }, [onCallIntegrations, notifiers]);
}
