import { produce } from 'immer';
import { useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';

import { useAppNotification } from '../../../../../../../core/copy/appNotification';
import { Receiver } from '../../../../../../../plugins/datasource/alertmanager/types';
import { NotifierDTO } from '../../../../../../../types';
import { ONCALL_INTEGRATION_V2_FEATURE, onCallApi } from '../../../../api/onCallApi';
import { usePluginBridge } from '../../../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../../../types/pluginBridges';
import { option } from '../../../../utils/notifier-types';
import { GRAFANA_APP_RECEIVERS_SOURCE_IMAGE } from '../types';

import { GRAFANA_ONCALL_INTEGRATION_TYPE, ReceiverTypes } from './onCall';

export enum OnCallIntegrationType {
  NewIntegration = 'new_oncall_integration',
  ExistingIntegration = 'existing_oncall_integration',
}

export enum OnCallIntegrationSetting {
  IntegrationType = 'integration_type',
  IntegrationName = 'integration_name',
}

enum OnCallIntegrationStatus {
  Disabled = 'disabled',
  // The old integration done exclusively on the OnCall side
  // Relies on automatic creation of contact points and altering notification policies
  // If enabled Alerting UI should not enable any OnCall integration features
  V1 = 'v1',
  // The new integration - On Alerting side we create OnCall integrations and use theirs URLs
  // as parameters for oncall contact points
  V2 = 'v2',
}

function useOnCallPluginStatus() {
  const {
    installed: isOnCallEnabled,
    loading: isPluginBridgeLoading,
    error: pluginError,
  } = usePluginBridge(SupportedPlugin.OnCall);

  const {
    data: onCallFeatures = [],
    error: onCallFeaturesError,
    isLoading: isOnCallFeaturesLoading,
  } = onCallApi.endpoints.features.useQuery(undefined, { skip: !isOnCallEnabled });

  const integrationStatus = useMemo((): OnCallIntegrationStatus => {
    if (!isOnCallEnabled) {
      return OnCallIntegrationStatus.Disabled;
    }
    // TODO Support for V2 integration should be added when the OnCall team introduces the necessary changes

    return onCallFeatures.includes(ONCALL_INTEGRATION_V2_FEATURE)
      ? OnCallIntegrationStatus.V2
      : OnCallIntegrationStatus.V1;
  }, [isOnCallEnabled, onCallFeatures]);

  const isAlertingV2IntegrationEnabled = useMemo(
    () => integrationStatus === OnCallIntegrationStatus.V2,
    [integrationStatus]
  );

  return {
    isOnCallEnabled,
    integrationStatus,
    isAlertingV2IntegrationEnabled,
    isOnCallStatusLoading: isPluginBridgeLoading || isOnCallFeaturesLoading,
    onCallError: pluginError ?? onCallFeaturesError,
  };
}

export function useOnCallIntegration() {
  const notifyApp = useAppNotification();

  const { isOnCallEnabled, integrationStatus, isAlertingV2IntegrationEnabled, isOnCallStatusLoading, onCallError } =
    useOnCallPluginStatus();

  const { useCreateIntegrationMutation, useGrafanaOnCallIntegrationsQuery, useLazyValidateIntegrationNameQuery } =
    onCallApi;

  const [validateIntegrationNameQuery, { isFetching: isValidating }] = useLazyValidateIntegrationNameQuery();
  const [createIntegrationMutation] = useCreateIntegrationMutation();

  const {
    data: grafanaOnCallIntegrations = [],
    isLoading: isLoadingOnCallIntegrations,
    isError: isIntegrationsQueryError,
  } = useGrafanaOnCallIntegrationsQuery(undefined, { skip: !isAlertingV2IntegrationEnabled });

  const onCallFormValidators = useMemo(() => {
    return {
      integration_name: async (value: string) => {
        try {
          await validateIntegrationNameQuery(value).unwrap();
          return true;
        } catch (error) {
          if (isFetchError(error) && error.status === 409) {
            return 'Integration of this name already exists in OnCall';
          }

          notifyApp.error('Failed to validate OnCall integration name. Is the OnCall API available?');
          throw error;
        }
      },
      url: (value: string) => {
        if (!isAlertingV2IntegrationEnabled) {
          return true;
        }

        return grafanaOnCallIntegrations.map((i) => i.integration_url).includes(value)
          ? true
          : 'Selection of existing OnCall integration is required';
      },
    };
  }, [grafanaOnCallIntegrations, validateIntegrationNameQuery, isAlertingV2IntegrationEnabled, notifyApp]);

  const extendOnCallReceivers = useCallback(
    (receiver: Receiver): Receiver => {
      if (!isAlertingV2IntegrationEnabled) {
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
    [isAlertingV2IntegrationEnabled]
  );

  const createOnCallIntegrations = useCallback(
    async (receiver: Receiver): Promise<Receiver> => {
      if (!isAlertingV2IntegrationEnabled) {
        return receiver;
      }

      const onCallIntegrations =
        receiver.grafana_managed_receiver_configs?.filter((c) => c.type === ReceiverTypes.OnCall) ?? [];
      const newOnCallIntegrations = onCallIntegrations.filter(
        (c) => c.settings[OnCallIntegrationSetting.IntegrationType] === OnCallIntegrationType.NewIntegration
      );

      const createNewOnCallIntegrationJobs = newOnCallIntegrations.map(async (c) => {
        const newIntegration = await createIntegrationMutation({
          integration: GRAFANA_ONCALL_INTEGRATION_TYPE,
          verbal_name: c.settings[OnCallIntegrationSetting.IntegrationName],
        }).unwrap();

        c.settings.url = newIntegration.integration_url;
      });

      await Promise.all(createNewOnCallIntegrationJobs);

      return produce(receiver, (draft) => {
        draft.grafana_managed_receiver_configs?.forEach((c) => {
          // Clean up the settings before sending the receiver to the backend
          // The settings object can contain any additional data but integration type and name are purely frontend thing
          // and should not be sent and kept in the backend
          if (c.type === ReceiverTypes.OnCall) {
            delete c.settings[OnCallIntegrationSetting.IntegrationType];
            delete c.settings[OnCallIntegrationSetting.IntegrationName];
          }
        });
      });
    },
    [isAlertingV2IntegrationEnabled, createIntegrationMutation]
  );

  const extendOnCallNotifierFeatures = useCallback(
    (notifier: NotifierDTO): NotifierDTO => {
      // If V2 integration is not enabled the receiver will not be extended
      // We still allow users to use this contact point but they need to provide URL manually
      // As they do for webhook integration
      // Removing the oncall notifier from the list of available notifiers has drawbacks - it's tricky to define what should happen
      // if someone turned off or downgraded the OnCall plugin but had some receivers configured with OnCall notifier
      // By falling back to plain URL input we allow users to change the config with OnCall disabled/not supporting V2 integration
      if (notifier.type === ReceiverTypes.OnCall && isAlertingV2IntegrationEnabled) {
        const options = notifier.options.filter((o) => o.propertyName !== 'url');

        const newIntegrationOption: SelectableValue<string> = {
          value: OnCallIntegrationType.NewIntegration,
          label: 'New OnCall integration',
          description: 'A new OnCall integration without escalation chains will be automatically created',
        };
        const existingIntegrationOption: SelectableValue<string> = {
          value: OnCallIntegrationType.ExistingIntegration,
          label: 'Existing OnCall integration',
          description: 'Use an existing OnCall integration',
        };

        options.unshift(
          option(OnCallIntegrationSetting.IntegrationType, 'How to connect to OnCall', '', {
            required: true,
            element: 'radio',
            defaultValue: newIntegrationOption,
            selectOptions: [newIntegrationOption, existingIntegrationOption],
          }),
          option(
            OnCallIntegrationSetting.IntegrationName,
            'Integration name',
            'The name of the new OnCall integration',
            {
              required: true,
              showWhen: { field: 'integration_type', is: OnCallIntegrationType.NewIntegration },
            }
          ),
          option('url', 'OnCall Integration', 'The OnCall integration to send alerts to', {
            element: 'select',
            required: true,
            showWhen: { field: 'integration_type', is: OnCallIntegrationType.ExistingIntegration },
            selectOptions: grafanaOnCallIntegrations.map((i) => ({
              label: i.display_name,
              description: i.integration_url,
              value: i.integration_url,
            })),
          })
        );

        return { ...notifier, options };
      }

      return notifier;
    },
    [grafanaOnCallIntegrations, isAlertingV2IntegrationEnabled]
  );

  return {
    integrationStatus,
    onCallNotifierMeta: {
      enabled: !!isOnCallEnabled,
      order: -1, // The default is 0. We want OnCall to be the first on the list
      description: isOnCallEnabled
        ? 'Connect effortlessly to Grafana OnCall'
        : 'Enable Grafana OnCall plugin to use this integration',
      iconUrl: GRAFANA_APP_RECEIVERS_SOURCE_IMAGE[SupportedPlugin.OnCall],
    },
    extendOnCallNotifierFeatures,
    extendOnCallReceivers,
    createOnCallIntegrations,
    onCallFormValidators,
    isLoadingOnCallIntegration: isLoadingOnCallIntegrations || isOnCallStatusLoading,
    isValidating,
    hasOnCallError: Boolean(onCallError) || isIntegrationsQueryError,
  };
}
