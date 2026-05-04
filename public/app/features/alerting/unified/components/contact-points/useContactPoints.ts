/**
 * This hook will combine data from both the Alertmanager config
 * and (if available) it will also fetch the status from the Grafana Managed status endpoint
 */

import { useMemo } from 'react';

import { base64UrlEncode } from '@grafana/alerting';
import {
  API_GROUP,
  API_VERSION,
  type Receiver as K8sReceiver,
  generatedAPI,
} from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { useOnCallIntegration } from 'app/features/alerting/unified/components/receivers/grafanaAppReceivers/onCall/useOnCallIntegration';
import { type BaseAlertmanagerArgs, type Skippable } from 'app/features/alerting/unified/types/hooks';
import { cloudNotifierTypes } from 'app/features/alerting/unified/utils/cloud-alertmanager-notifier-types';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import {
  receiverConfigToK8sIntegration,
  shouldUseK8sApi,
  stringifyFieldSelector,
} from 'app/features/alerting/unified/utils/k8s/utils';
import { type GrafanaManagedContactPoint, type Receiver } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { useIntegrationTypeSchemas } from '../../api/integrationSchemasApi';
import { onCallApi } from '../../api/onCallApi';
import { useAsync } from '../../hooks/useAsync';
import { useIrmPlugin } from '../../hooks/usePluginBridge';
import { useProduceNewAlertmanagerConfiguration } from '../../hooks/useProduceNewAlertmanagerConfig';
import { addReceiverAction, deleteReceiverAction, updateReceiverAction } from '../../reducers/alertmanager/receivers';
import { KnownProvenance } from '../../types/knownProvenance';
import { SupportedPlugin } from '../../types/pluginBridges';
import { K8sAnnotations } from '../../utils/k8s/constants';

import { enhanceContactPointsWithMetadata } from './utils';

const RECEIVER_STATUS_POLLING_INTERVAL = 10 * 1000; // 10 seconds

/**
 * This hook will combine data from several endpoints;
 * 1. the alertmanager config endpoint where the definition of the receivers are
 * 2. (if available) the alertmanager receiver status endpoint, currently Grafana Managed only
 * 3. (if available) additional metadata about Grafana Managed contact points
 * 4. (if available) the OnCall plugin metadata
 */

const {
  useGetAlertmanagerConfigurationQuery,
  useGetContactPointsStatusQuery,
  useLazyGetAlertmanagerConfigurationQuery,
} = alertmanagerApi;
const { useGrafanaOnCallIntegrationsQuery } = onCallApi;
const {
  useListReceiverQuery,
  useGetReceiverQuery,
  useDeleteReceiverMutation,
  useCreateReceiverMutation,
  useReplaceReceiverMutation,
} = generatedAPI;

const defaultOptions = {
  refetchOnFocus: true,
  refetchOnReconnect: true,
};

/**
 * Check if OnCall is installed, and fetch the list of integrations if so.
 *
 * Otherwise, returns no data
 */
const useOnCallIntegrations = ({ skip }: Skippable = {}) => {
  const { pluginId, installed, loading } = useIrmPlugin(SupportedPlugin.OnCall);
  const oncallIntegrationsResponse = useGrafanaOnCallIntegrationsQuery({ pluginId }, { skip: skip || !installed });

  return useMemo(() => {
    if (installed) {
      return oncallIntegrationsResponse;
    }
    return {
      isLoading: loading,
      data: undefined,
    };
  }, [installed, loading, oncallIntegrationsResponse]);
};

/** Maps a notifications API `Receiver` to the unified contact point shape (also used after save mutations). */
export function parseK8sReceiver(item: K8sReceiver): GrafanaManagedContactPoint {
  const metadataProvenance = item.metadata.annotations?.[K8sAnnotations.Provenance];
  const provenance = metadataProvenance === KnownProvenance.None ? undefined : metadataProvenance;

  return {
    id: item.metadata.name || item.metadata.uid || item.spec.title,
    name: item.spec.title,
    provenance: provenance,
    grafana_managed_receiver_configs: item.spec.integrations,
    metadata: item.metadata,
  };
}

const useK8sContactPoints = (...[hookParams, queryOptions]: Parameters<typeof useListReceiverQuery>) => {
  return useListReceiverQuery(hookParams, {
    ...queryOptions,
    selectFromResult: (result) => {
      const data = result.data?.items.map((item) => parseK8sReceiver(item));

      return {
        ...result,
        // K8S API will return 403 error for no-permissions case, so its cleaner to fallback to empty array
        data: result.error ? [] : data,
        currentData: data,
      };
    },
  });
};

type GrafanaFetchOptions = {
  /**
   * Should we fetch and include status information about each contact point?
   */
  fetchStatuses?: boolean;
  /**
   * Should we fetch and include the number of notification policies that reference each contact point?
   */
  fetchPolicies?: boolean;
};

/**
 * Fetch list of contact points from separate endpoint (i.e. not the Alertmanager config) and combine with
 * OnCall integrations and any additional metadata from list of notifiers
 * (e.g. hydrate with additional names/descriptions)
 */
export const useGrafanaContactPoints = ({
  fetchStatuses,
  fetchPolicies,
  skip,
}: GrafanaFetchOptions & Skippable = {}) => {
  const potentiallySkip = { skip };

  // Get the IRM/OnCall plugin information
  const irmOrOnCallPlugin = useIrmPlugin(SupportedPlugin.OnCall);

  const onCallResponse = useOnCallIntegrations(potentiallySkip);
  const alertNotifiers = useIntegrationTypeSchemas(potentiallySkip);
  const contactPointsListResponse = useK8sContactPoints({}, potentiallySkip);

  const contactPointsStatusResponse = useGetContactPointsStatusQuery(undefined, {
    ...defaultOptions,
    pollingInterval: RECEIVER_STATUS_POLLING_INTERVAL,
    skip: skip || !fetchStatuses,
  });
  const alertmanagerConfigResponse = useGetAlertmanagerConfigurationQuery(GRAFANA_RULES_SOURCE_NAME, {
    skip: skip || !fetchPolicies,
  });

  return useMemo(() => {
    const isLoading = onCallResponse.isLoading || alertNotifiers.isLoading || contactPointsListResponse.isLoading;

    if (isLoading) {
      return {
        ...contactPointsListResponse,
        // If we're inside this block, it means that at least one of the endpoints we care about is still loading,
        // but the contactPointsListResponse may have in fact finished.
        // If we were to use _that_ loading state, it might be inaccurate elsewhere when consuming this hook,
        // so we explicitly say "yes, this is definitely still loading"
        isLoading: true,
        contactPoints: [],
      };
    }

    const enhanced = enhanceContactPointsWithMetadata({
      status: contactPointsStatusResponse.data,
      notifiers: alertNotifiers.data,
      onCallIntegrations: onCallResponse?.data,
      onCallPluginId: irmOrOnCallPlugin.pluginId,
      contactPoints: contactPointsListResponse.data || [],
      alertmanagerConfiguration: alertmanagerConfigResponse.data,
    });

    return {
      ...contactPointsListResponse,
      contactPoints: enhanced,
    };
  }, [
    alertNotifiers,
    alertmanagerConfigResponse,
    contactPointsListResponse,
    contactPointsStatusResponse,
    onCallResponse,
    irmOrOnCallPlugin.pluginId,
  ]);
};

/**
 * Fetch single contact point via the alertmanager config
 */
const useGetAlertmanagerContactPoint = (
  { alertmanager, name }: BaseAlertmanagerArgs & { name: string },
  queryOptions?: Parameters<typeof useGetAlertmanagerConfigurationQuery>[1]
) => {
  return useGetAlertmanagerConfigurationQuery(alertmanager, {
    ...queryOptions,
    selectFromResult: (result) => {
      const matchedContactPoint = result.data?.alertmanager_config.receivers?.find(
        (receiver) => receiver.name === name
      );
      return {
        ...result,
        data: matchedContactPoint,
        currentData: matchedContactPoint,
      };
    },
  });
};

/**
 * Load one Grafana-managed receiver via `GET .../receivers/{name}`.
 * If `name` is a display title and the live resource id is `base64UrlEncode(title)`, the GET may 404; we then
 * list with `metadata.name = base64UrlEncode(name)` (same resolution as the notifications UI).
 */
const useGetGrafanaContactPoint = (
  { name }: { name: string },
  queryOptions?: Parameters<typeof useGetReceiverQuery>[1]
) => {
  const skipBase = Boolean(queryOptions?.skip || !name);

  const primary = useGetReceiverQuery({ name }, { ...queryOptions, skip: skipBase });

  const parsedFromPrimary = primary.isSuccess && primary.data ? parseK8sReceiver(primary.data) : undefined;

  // Do not require `primary.isFetched`: for this endpoint, RTK Query can report `isFetched: false` on a failed GET
  // while `isError` is true, which would block the list fallback and leave the 404 visible to consumers.
  const needsEncodedNameLookup = !skipBase && !parsedFromPrimary && primary.isError;

  const listQuery = useListReceiverQuery(
    {
      fieldSelector: stringifyFieldSelector([['metadata.name', base64UrlEncode(name)]]),
    },
    {
      skip: skipBase || !needsEncodedNameLookup,
    }
  );

  const parsedFromList = listQuery.data?.items?.[0] ? parseK8sReceiver(listQuery.data.items[0]) : undefined;

  return useMemo(() => {
    if (skipBase) {
      return primary;
    }

    if (parsedFromPrimary) {
      return {
        ...primary,
        data: parsedFromPrimary,
        currentData: parsedFromPrimary,
        isLoading: primary.isLoading || primary.isFetching,
        isSuccess: true,
        isError: false,
        error: undefined,
      };
    }

    if (needsEncodedNameLookup) {
      if (parsedFromList) {
        return {
          ...listQuery,
          data: parsedFromList,
          currentData: parsedFromList,
          isLoading: listQuery.isLoading || listQuery.isFetching,
          isSuccess: true,
          isError: false,
          error: undefined,
        };
      }
      // Until the list request settles, avoid surfacing the primary GET error (e.g. 404 when `name` is a title).
      // Use `status` — `isFetched` is absent on some RTK Query union members (e.g. uninitialized).
      const listRequestCompleted = listQuery.status === 'fulfilled' || listQuery.status === 'rejected';
      if (!listRequestCompleted) {
        return {
          ...listQuery,
          data: undefined,
          currentData: undefined,
          isLoading: true,
          isSuccess: false,
          isError: false,
          error: undefined,
        };
      }
      return {
        ...listQuery,
        data: undefined,
        currentData: undefined,
        isLoading: false,
        isSuccess: false,
        isError: Boolean(listQuery.isError || primary.isError),
        error: listQuery.error ?? primary.error,
      };
    }

    if (primary.isLoading || primary.isFetching) {
      return {
        ...primary,
        data: undefined,
        currentData: undefined,
        isLoading: true,
        isSuccess: false,
        isError: false,
        error: undefined,
      };
    }

    return {
      ...primary,
      data: undefined,
      currentData: undefined,
      isLoading: false,
      isSuccess: false,
      isError: primary.isError,
      error: primary.error,
    };
  }, [skipBase, primary, parsedFromPrimary, needsEncodedNameLookup, listQuery, parsedFromList]);
};

export interface UseGetContactPointArgs {
  alertmanager: string;
  /**
   * For Grafana-managed (K8s) contact points, the path segment is the live `metadata.name` for that object
   * (see `parseK8sReceiver` / list `id`); it is not the same as the display `spec.title` when the name was
   * generated for the store.
   */
  name: string;
  skip?: boolean;
}

export function useGetContactPoint({ alertmanager, name, skip: skipQuery }: UseGetContactPointArgs) {
  const isGrafana = alertmanager === GRAFANA_RULES_SOURCE_NAME;

  const grafanaResponse = useGetGrafanaContactPoint({ name }, { skip: skipQuery || !isGrafana });
  const alertmanagerResponse = useGetAlertmanagerContactPoint({ alertmanager, name }, { skip: skipQuery || isGrafana });

  return isGrafana ? grafanaResponse : alertmanagerResponse;
}

export function useContactPointsWithStatus({
  alertmanager,
  fetchStatuses,
  fetchPolicies,
  skip,
}: GrafanaFetchOptions & BaseAlertmanagerArgs & Skippable) {
  const isGrafanaAlertmanager = alertmanager === GRAFANA_RULES_SOURCE_NAME;
  const grafanaResponse = useGrafanaContactPoints({
    skip: skip || !isGrafanaAlertmanager,
    fetchStatuses,
    fetchPolicies,
  });

  const alertmanagerConfigResponse = useGetAlertmanagerConfigurationQuery(alertmanager, {
    ...defaultOptions,
    selectFromResult: (result) => ({
      ...result,
      contactPoints: result.data
        ? enhanceContactPointsWithMetadata({
            notifiers: cloudNotifierTypes,
            contactPoints: result.data.alertmanager_config.receivers ?? [],
            alertmanagerConfiguration: result.data,
          })
        : [],
    }),
    skip: skip || isGrafanaAlertmanager,
  });

  return isGrafanaAlertmanager ? grafanaResponse : alertmanagerConfigResponse;
}

type DeleteContactPointArgs = { name: string; resourceVersion?: string };
export function useDeleteContactPoint({ alertmanager }: BaseAlertmanagerArgs) {
  const useK8sApi = shouldUseK8sApi(alertmanager);

  const [produceNewAlertmanagerConfiguration] = useProduceNewAlertmanagerConfiguration();
  const [deleteReceiver] = useDeleteReceiverMutation();

  const deleteFromK8sAPI = useAsync(async ({ name }: DeleteContactPointArgs) => {
    await deleteReceiver({ name }).unwrap();
  });

  const deleteFromAlertmanagerConfiguration = useAsync(async ({ name }: DeleteContactPointArgs) => {
    const action = deleteReceiverAction(name);
    return produceNewAlertmanagerConfiguration(action);
  });

  return useK8sApi ? deleteFromK8sAPI : deleteFromAlertmanagerConfiguration;
}

const grafanaContactPointToK8sReceiver = (
  contactPoint: GrafanaManagedContactPoint,
  id?: string,
  resourceVersion?: string
): K8sReceiver => {
  return {
    apiVersion: `${API_GROUP}/${API_VERSION}`,
    kind: 'Receiver',
    metadata: {
      ...(id && { name: id }),
      resourceVersion,
    },
    spec: {
      title: contactPoint.name,
      integrations: (contactPoint.grafana_managed_receiver_configs || []).map(receiverConfigToK8sIntegration),
    },
  };
};

type ContactPointOperationArgs = {
  contactPoint: Receiver;
};

type CreateContactPointArgs = ContactPointOperationArgs;

export const useCreateContactPoint = ({ alertmanager }: BaseAlertmanagerArgs) => {
  const isGrafanaAlertmanager = alertmanager === GRAFANA_RULES_SOURCE_NAME;

  const { createOnCallIntegrations } = useOnCallIntegration();
  const [createGrafanaContactPoint] = useCreateReceiverMutation();
  const [produceNewAlertmanagerConfiguration] = useProduceNewAlertmanagerConfiguration();

  const updateK8sAPI = useAsync(async ({ contactPoint }: CreateContactPointArgs) => {
    const contactPointWithMaybeOnCall = await createOnCallIntegrations(contactPoint);

    const contactPointToUse = grafanaContactPointToK8sReceiver(contactPointWithMaybeOnCall);

    return createGrafanaContactPoint({
      receiver: contactPointToUse,
    }).unwrap();
  });

  const updateAlertmanagerConfiguration = useAsync(async ({ contactPoint }: CreateContactPointArgs) => {
    const action = addReceiverAction(contactPoint);
    return produceNewAlertmanagerConfiguration(action);
  });

  return isGrafanaAlertmanager ? updateK8sAPI : updateAlertmanagerConfiguration;
};

type UpdateContactPointArgsK8s = ContactPointOperationArgs & {
  /** ID of existing contact point to update - used when updating via k8s API */
  id: string;
  resourceVersion?: string;
};
type UpdateContactPointArgsConfig = ContactPointOperationArgs & {
  /** Name of the existing contact point - used for checking uniqueness of name when not using k8s API*/
  originalName: string;
};
type UpdateContactpointArgs = UpdateContactPointArgsK8s | UpdateContactPointArgsConfig;

export const useUpdateContactPoint = ({ alertmanager }: BaseAlertmanagerArgs) => {
  const isGrafanaAlertmanager = alertmanager === GRAFANA_RULES_SOURCE_NAME;
  const useK8sApi = shouldUseK8sApi(alertmanager);

  const { createOnCallIntegrations } = useOnCallIntegration();
  const [replaceGrafanaContactPoint] = useReplaceReceiverMutation();
  const [produceNewAlertmanagerConfiguration] = useProduceNewAlertmanagerConfiguration();

  const updateContactPoint = useAsync(async (args: UpdateContactpointArgs) => {
    if ('resourceVersion' in args && useK8sApi) {
      const { contactPoint, id, resourceVersion } = args;

      const receiverWithPotentialOnCall = isGrafanaAlertmanager
        ? await createOnCallIntegrations(contactPoint)
        : contactPoint;

      const contactPointToUse = grafanaContactPointToK8sReceiver(receiverWithPotentialOnCall, id, resourceVersion);

      return replaceGrafanaContactPoint({
        name: id,
        receiver: contactPointToUse,
      }).unwrap();
    } else if ('originalName' in args) {
      const { contactPoint, originalName } = args;
      const receiverWithPotentialOnCall = isGrafanaAlertmanager
        ? await createOnCallIntegrations(contactPoint)
        : contactPoint;

      const action = updateReceiverAction({ name: originalName, receiver: receiverWithPotentialOnCall });
      return produceNewAlertmanagerConfiguration(action);
    }
  });

  return updateContactPoint;
};

export const useValidateContactPoint = ({ alertmanager }: BaseAlertmanagerArgs) => {
  const [getConfig] = useLazyGetAlertmanagerConfigurationQuery();

  // If we're updating the Grafana AM entities,
  // then we let the API response handle the validation instead
  // as we don't expect to be able to fetch the contact points via the AM config
  if (alertmanager === GRAFANA_RULES_SOURCE_NAME) {
    return () => undefined;
  }

  return async (value: string, existingValue?: string) => {
    // If we've been given an existing value, and the name has not changed,
    // we can skip validation
    // (as we don't want to incorrectly flag the existing name as matching itself)
    if (existingValue && value === existingValue) {
      return;
    }
    return getConfig(alertmanager)
      .unwrap()
      .then((config) => {
        const { alertmanager_config } = config;
        const duplicated = Boolean(alertmanager_config.receivers?.find((contactPoint) => contactPoint.name === value));
        return duplicated ? `Contact point already exists with name "${value}"` : undefined;
      });
  };
};
