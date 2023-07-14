import produce from 'immer';
import { useCallback, useMemo } from 'react';

import { Receiver } from '../../../../../../../plugins/datasource/alertmanager/types';
import { NotifierDTO } from '../../../../../../../types';
import { onCallApi } from '../../../../api/onCallApi';
import { usePluginBridge } from '../../../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../../../types/pluginBridges';
import { option } from '../../../../utils/notifier-types';
import { GRAFANA_APP_RECEIVERS_SOURCE_IMAGE } from '../types';

import { ReceiverTypes } from './onCall';

const GRAFANA_INTEGRATION_TYPE = 'grafana';

export function useOnCallIntegration() {
  const {
    installed: isOnCallEnabled,
    loading: isPluginBridgeLoading,
    error: pluginError,
  } = usePluginBridge(SupportedPlugin.OnCall);

  const { useCreateIntegrationMutation, useGetOnCallIntegrationsQuery } = onCallApi;

  const [createIntegrationMutation] = useCreateIntegrationMutation();

  const {
    data: onCallIntegrations = [],
    isLoading: isLoadingOnCallIntegrations,
    isError: isIntegrationsQueryError,
  } = useGetOnCallIntegrationsQuery(undefined, { skip: !isOnCallEnabled });

  const grafanaOnCallIntegrations = useMemo(() => {
    return onCallIntegrations.filter((i) => i.integration === GRAFANA_INTEGRATION_TYPE);
  }, [onCallIntegrations]);

  const onCallFormValidators = useMemo(() => {
    return {
      integration_name: (value: string) => {
        return grafanaOnCallIntegrations.map((i) => i.verbal_name).includes(value)
          ? 'Integration of this name already exists in OnCall'
          : true;
      },
      url: (value: string) => {
        if (!isOnCallEnabled) {
          return true;
        }

        return grafanaOnCallIntegrations.map((i) => i.integration_url).includes(value)
          ? true
          : 'Selection of existing OnCall integration is required';
      },
    };
  }, [grafanaOnCallIntegrations, isOnCallEnabled]);

  const extendOnCalReceivers = useCallback(
    (receiver: Receiver): Receiver => {
      if (!isOnCallEnabled) {
        return receiver;
      }

      return produce(receiver, (draft) => {
        draft.grafana_managed_receiver_configs?.forEach((config) => {
          if (config.type === ReceiverTypes.OnCall) {
            config.settings['integration_type'] = 'existing_oncall_integration';
          }
        });
      });
    },
    [isOnCallEnabled]
  );

  const createOnCallIntegrations = useCallback(
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

        c.settings['url'] = newIntegration.integration_url;
      });

      await Promise.all(createNewOnCallIntegrationJobs);

      return produce(receiver, (draft) => {
        draft.grafana_managed_receiver_configs?.forEach((c) => {
          if (c.type === 'oncall') {
            delete c.settings['integration_type'];
            delete c.settings['integration_name'];
          }
        });
      });
    },
    [isOnCallEnabled, createIntegrationMutation]
  );

  const extendOnCallNotifierFeatures = useCallback(
    (notifier: NotifierDTO): NotifierDTO => {
      if (notifier.type === 'oncall' && isOnCallEnabled) {
        const options = notifier.options.filter((o) => o.propertyName !== 'url');

        options.unshift(
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
          option('url', 'OnCall Integration', 'The OnCall integration to send alerts to', {
            element: 'select',
            required: true,
            showWhen: { field: 'integration_type', is: 'existing_oncall_integration' },
            selectOptions: onCallIntegrations.map((i) => ({
              label: i.verbal_name,
              description: i.integration_url,
              value: i.integration_url,
            })),
          })
        );

        return { ...notifier, options };
      }

      return notifier;
    },
    [onCallIntegrations, isOnCallEnabled]
  );

  return {
    onCallNotifierMeta: {
      enabled: !!isOnCallEnabled,
      order: 1,
      description: isOnCallEnabled
        ? 'Connect effortlessly to Grafana OnCall'
        : 'Enable Grafana OnCall plugin to use this integration',
      iconUrl: GRAFANA_APP_RECEIVERS_SOURCE_IMAGE[SupportedPlugin.OnCall],
    },
    extendOnCallNotifierFeatures,
    extendOnCalReceivers,
    createOnCallIntegrations,
    onCallFormValidators,
    isLoadingOnCallIntegration: isLoadingOnCallIntegrations || isPluginBridgeLoading,
    hasOnCallError: Boolean(pluginError) || isIntegrationsQueryError,
  };
}
