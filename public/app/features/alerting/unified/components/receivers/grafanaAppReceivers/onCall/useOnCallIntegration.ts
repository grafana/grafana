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

// TODO This value needs to be changed to grafana_alerting when the OnCall team introduces the necessary changes
export const GRAFANA_ONCALL_INTEGRATION_TYPE = 'grafana';

export enum OnCallIntegrationType {
  NewIntegration = 'new_oncall_integration',
  ExistingIntegration = 'existing_oncall_integration',
}

export enum OnCallIntegrationSetting {
  IntegrationType = 'integration_type',
  IntegrationName = 'integration_name',
}

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

  const onCallFormValidators = useMemo(() => {
    // URL should be one of exsiting OnCall integrations of "grafana_alerting" type
    const grafanaOnCallIntegrations = onCallIntegrations.filter(
      (i) => i.integration === GRAFANA_ONCALL_INTEGRATION_TYPE
    );

    return {
      integration_name: (value: string) => {
        // The name needs to be unique among all OnCall integrations
        return onCallIntegrations.map((i) => i.verbal_name).includes(value)
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
  }, [onCallIntegrations, isOnCallEnabled]);

  const extendOnCalReceivers = useCallback(
    (receiver: Receiver): Receiver => {
      if (!isOnCallEnabled) {
        return receiver;
      }

      return produce(receiver, (draft) => {
        draft.grafana_managed_receiver_configs?.forEach((config) => {
          if (config.type === ReceiverTypes.OnCall) {
            config.settings[OnCallIntegrationSetting.IntegrationType] = OnCallIntegrationType.ExistingIntegration;
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
        (c) => c.settings[OnCallIntegrationSetting.IntegrationType] === OnCallIntegrationType.NewIntegration
      );

      const createNewOnCallIntegrationJobs = newOnCallIntegrations.map(async (c) => {
        const newIntegration = await createIntegrationMutation({
          integration: GRAFANA_ONCALL_INTEGRATION_TYPE,
          verbal_name: c.settings[OnCallIntegrationSetting.IntegrationName],
        }).unwrap();

        c.settings['url'] = newIntegration.integration_url;
      });

      await Promise.all(createNewOnCallIntegrationJobs);

      return produce(receiver, (draft) => {
        draft.grafana_managed_receiver_configs?.forEach((c) => {
          if (c.type === ReceiverTypes.OnCall) {
            delete c.settings[OnCallIntegrationSetting.IntegrationType];
            delete c.settings[OnCallIntegrationSetting.IntegrationName];
          }
        });
      });
    },
    [isOnCallEnabled, createIntegrationMutation]
  );

  const extendOnCallNotifierFeatures = useCallback(
    (notifier: NotifierDTO): NotifierDTO => {
      if (notifier.type === ReceiverTypes.OnCall && isOnCallEnabled) {
        const options = notifier.options.filter((o) => o.propertyName !== 'url');

        options.unshift(
          option(OnCallIntegrationSetting.IntegrationType, 'How to connect to OnCall', '', {
            required: true,
            element: 'radio',
            selectOptions: [
              {
                value: OnCallIntegrationType.NewIntegration,
                label: 'New OnCall integration',
                description: 'A new OnCall integration without escalation chains will be automatically created',
              },
              {
                value: OnCallIntegrationType.ExistingIntegration,
                label: 'Existing OnCall integration',
                description: 'Use an existing OnCall integration',
              },
            ],
          }),
          option(
            OnCallIntegrationSetting.IntegrationName,
            'Integration name',
            'The name of the new OnCall integration',
            {
              required: true,
              showWhen: { field: 'integration_type', is: 'new_oncall_integration' },
            }
          ),
          option('url', 'OnCall Integration', 'The OnCall integration to send alerts to', {
            element: 'select',
            required: true,
            showWhen: { field: 'integration_type', is: 'existing_oncall_integration' },
            selectOptions: onCallIntegrations
              .filter((i) => i.integration === GRAFANA_ONCALL_INTEGRATION_TYPE)
              .map((i) => ({
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
