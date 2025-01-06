import memoize from 'micro-memoize';

import { routingTreeApi } from 'app/features/alerting/unified/api/notificationPoliciesApi';
import { BaseAlertmanagerArgs, Skippable } from 'app/features/alerting/unified/types/hooks';
import { MatcherOperator, Route } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import {
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route,
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree,
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTreeSpec,
} from '../../openapi/routesApi.gen';
import { PROVENANCE_NONE, ROOT_ROUTE_NAME } from '../../utils/k8s/constants';
import { ERROR_NEWER_CONFIGURATION } from '../../utils/k8s/errors';
import { getK8sNamespace, isK8sEntityProvisioned, shouldUseK8sApi } from '../../utils/k8s/utils';
const k8sRoutesToRoutesMemoized = memoize(k8sRoutesToRoutes, { maxSize: 1 });

const { useListNamespacedRoutingTreeQuery, useReplaceNamespacedRoutingTreeMutation } = routingTreeApi;

const {
  useUpdateAlertmanagerConfigurationMutation,
  useLazyGetAlertmanagerConfigurationQuery,
  useGetAlertmanagerConfigurationQuery,
} = alertmanagerApi;

export const useNotificationPolicyRoute = ({ alertmanager }: BaseAlertmanagerArgs, { skip }: Skippable = {}) => {
  const k8sApiSupported = shouldUseK8sApi(alertmanager);

  const k8sRouteQuery = useListNamespacedRoutingTreeQuery(
    { namespace: getK8sNamespace() },
    {
      skip: skip || !k8sApiSupported,
      selectFromResult: (result) => {
        return {
          ...result,
          currentData: result.currentData ? k8sRoutesToRoutesMemoized(result.currentData.items) : undefined,
          data: result.data ? k8sRoutesToRoutesMemoized(result.data.items) : undefined,
        };
      },
    }
  );

  const amConfigQuery = useGetAlertmanagerConfigurationQuery(alertmanager, {
    skip: skip || k8sApiSupported,
    selectFromResult: (result) => {
      return {
        ...result,
        currentData: result.currentData?.alertmanager_config?.route
          ? [parseAmConfigRoute(result.currentData.alertmanager_config.route)]
          : undefined,
        data: result.data?.alertmanager_config?.route
          ? [parseAmConfigRoute(result.data.alertmanager_config.route)]
          : undefined,
      };
    },
  });

  return k8sApiSupported ? k8sRouteQuery : amConfigQuery;
};

const parseAmConfigRoute = memoize((route: Route): Route => {
  return {
    ...route,
    _metadata: { provisioned: Boolean(route.provenance && route.provenance !== PROVENANCE_NONE) },
  };
});

export function useUpdateNotificationPolicyRoute(selectedAlertmanager: string) {
  const [getAlertmanagerConfiguration] = useLazyGetAlertmanagerConfigurationQuery();
  const [updateAlertmanagerConfiguration] = useUpdateAlertmanagerConfigurationMutation();

  const [updatedNamespacedRoute] = useReplaceNamespacedRoutingTreeMutation();

  const k8sApiSupported = shouldUseK8sApi(selectedAlertmanager);

  async function updateUsingK8sApi({ newRoute }: { newRoute: Route }) {
    const namespace = getK8sNamespace();
    const { routes, _metadata, ...defaults } = newRoute;
    // Remove provenance so we don't send it to API
    // Convert Route to K8s compatible format
    const k8sRoute: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTreeSpec = {
      defaults: {
        ...defaults,
        // TODO: Fix types in k8s API? Fix our types to not allow empty receiver? TBC
        receiver: defaults.receiver || '',
      },
      routes: newRoute.routes?.map(routeToK8sSubRoute) || [],
    };

    // Create the K8s route object
    const routeObject: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree = {
      spec: k8sRoute,
      metadata: { name: ROOT_ROUTE_NAME, resourceVersion: _metadata?.resourceVersion },
    };

    return updatedNamespacedRoute({
      name: ROOT_ROUTE_NAME,
      namespace,
      comGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree: routeObject,
    }).unwrap();
  }

  async function updateUsingConfigFileApi({ newRoute, oldRoute }: { newRoute: Route; oldRoute: Route }) {
    const { _metadata, ...oldRouteStripped } = oldRoute;
    const { _metadata: newMetadata, ...newRouteStripped } = newRoute;
    const lastConfig = await getAlertmanagerConfiguration(selectedAlertmanager).unwrap();
    const latestRouteFromConfig = lastConfig.alertmanager_config.route;

    const configChangedInMeantime = JSON.stringify(oldRouteStripped) !== JSON.stringify(latestRouteFromConfig);

    if (configChangedInMeantime) {
      throw new Error('configuration modification conflict', { cause: ERROR_NEWER_CONFIGURATION });
    }

    const newConfig = {
      ...lastConfig,
      alertmanager_config: {
        ...lastConfig.alertmanager_config,
        route: newRouteStripped,
      },
    };

    // TODO This needs to properly handle lazy AM initialization
    return updateAlertmanagerConfiguration({
      selectedAlertmanager,
      config: newConfig,
    }).unwrap();
  }

  return k8sApiSupported ? updateUsingK8sApi : updateUsingConfigFileApi;
}

function k8sRoutesToRoutes(routes: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree[]): Route[] {
  return routes?.map((route) => {
    return {
      ...route.spec.defaults,
      routes: route.spec.routes?.map(k8sSubRouteToRoute),
      _metadata: {
        provisioned: isK8sEntityProvisioned(route),
        resourceVersion: route.metadata.resourceVersion,
        name: route.metadata.name,
      },
    };
  });
}

/** Helper to provide type safety for matcher operators from API */
function isValidMatcherOperator(type: string): type is MatcherOperator {
  return Object.values<string>(MatcherOperator).includes(type);
}

function k8sSubRouteToRoute(route: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route): Route {
  return {
    ...route,
    routes: route.routes?.map(k8sSubRouteToRoute),
    matchers: undefined,
    object_matchers: route.matchers?.map(({ label, type, value }) => {
      if (!isValidMatcherOperator(type)) {
        throw new Error(`Invalid matcher operator from API: ${type}`);
      }
      return [label, type, value];
    }),
  };
}

function routeToK8sSubRoute(route: Route): ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route {
  const { object_matchers, ...rest } = route;
  return {
    ...rest,
    receiver: route.receiver ?? undefined,
    matchers: object_matchers?.map(([label, type, value]) => ({
      label,
      type,
      value,
    })),
    routes: route.routes?.map(routeToK8sSubRoute),
  };
}
