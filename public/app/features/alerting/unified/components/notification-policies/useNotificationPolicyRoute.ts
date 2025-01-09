import memoize from 'micro-memoize';

import { routingTreeApi } from 'app/features/alerting/unified/api/notificationPoliciesApi';
import { BaseAlertmanagerArgs, Skippable } from 'app/features/alerting/unified/types/hooks';
import { MatcherOperator, Route } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { useAsync } from '../../hooks/useAsync';
import { useProduceNewAlertmanagerConfiguration } from '../../hooks/useProduceNewAlertmanagerConfig';
import {
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route,
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree,
} from '../../openapi/routesApi.gen';
import {
  addRouteAction,
  deleteRouteAction,
  updateRouteAction,
} from '../../reducers/alertmanager/notificationPolicyRoutes';
import { FormAmRoute } from '../../types/amroutes';
import { PROVENANCE_NONE } from '../../utils/k8s/constants';
import { getK8sNamespace, isK8sEntityProvisioned, shouldUseK8sApi } from '../../utils/k8s/utils';
import { InsertPosition } from '../../utils/routeTree';

const k8sRoutesToRoutesMemoized = memoize(k8sRoutesToRoutes, { maxSize: 1 });

const { useListNamespacedRoutingTreeQuery } = routingTreeApi;

const { useGetAlertmanagerConfigurationQuery } = alertmanagerApi;

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

// type CreateUpdateRouteArgs = { newRoute: Route };

// export function useUpdateNotificationPolicyRoute({ alertmanager }: BaseAlertmanagerArgs) {
//   // for alertmanager config api
//   const [produceNewAlertmanagerConfiguration] = useProduceNewAlertmanagerConfiguration();
//   // for k8s api
//   const [updatedNamespacedRoute] = useReplaceNamespacedRoutingTreeMutation();

//   const k8sApiSupported = shouldUseK8sApi(alertmanager);

//   const updateUsingK8sApi = useAsync(({ newRoute }: { newRoute: Route }) => {
//     const namespace = getK8sNamespace();
//     const { routes, _metadata, ...defaults } = newRoute;
//     // Remove provenance so we don't send it to API
//     // Convert Route to K8s compatible format
//     const k8sRoute: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTreeSpec = {
//       defaults: {
//         ...defaults,
//         // TODO: Fix types in k8s API? Fix our types to not allow empty receiver? TBC
//         receiver: defaults.receiver || '',
//       },
//       routes: newRoute.routes?.map(routeToK8sSubRoute) || [],
//     };

//     // Create the K8s route object
//     const routeObject: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree = {
//       spec: k8sRoute,
//       metadata: { name: ROOT_ROUTE_NAME, resourceVersion: _metadata?.resourceVersion },
//     };

//     return updatedNamespacedRoute({
//       name: ROOT_ROUTE_NAME,
//       namespace,
//       comGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree: routeObject,
//     }).unwrap();
//   });

//   const updateRouteUsingConfigFileApi = useAsync(
//     async ({ newRoute, oldRoute }: CreateUpdateRouteArgs & { oldRoute: Route }) => {
//       const action = updateRouteAction({ newRoute, oldRoute });
//       return produceNewAlertmanagerConfiguration(action);
//     }
//   );

//   return k8sApiSupported ? updateUsingK8sApi : updateRouteUsingConfigFileApi;
// }

export function useUpdateExistingNotificationPolicy({ alertmanager }: BaseAlertmanagerArgs) {
  const [produceNewAlertmanagerConfiguration] = useProduceNewAlertmanagerConfiguration();
  const k8sApiSupported = shouldUseK8sApi(alertmanager);

  // @TODO
  const updateK8sApi = useAsync(async (update: Partial<FormAmRoute>) => {});

  const updateFromAlertmanagerConfiguration = useAsync(async (update: Partial<FormAmRoute>) => {
    const action = updateRouteAction({ update, alertmanager });
    return produceNewAlertmanagerConfiguration(action);
  });

  return k8sApiSupported ? updateK8sApi : updateFromAlertmanagerConfiguration;
}

export function useDeleteNotificationPolicy({ alertmanager }: BaseAlertmanagerArgs) {
  const [produceNewAlertmanagerConfiguration] = useProduceNewAlertmanagerConfiguration();
  const k8sApiSupported = shouldUseK8sApi(alertmanager);

  // @TODO
  const deleteFromK8sApi = useAsync(async (id: string) => {
    // check for mutations from other users
  });

  const deleteFromAlertmanagerConfiguration = useAsync(async (id: string) => {
    const action = deleteRouteAction({ id });
    return produceNewAlertmanagerConfiguration(action);
  });

  return k8sApiSupported ? deleteFromK8sApi : deleteFromAlertmanagerConfiguration;
}

export function useAddNotificationPolicy({ alertmanager }: BaseAlertmanagerArgs) {
  const [produceNewAlertmanagerConfiguration] = useProduceNewAlertmanagerConfiguration();
  const k8sApiSupported = shouldUseK8sApi(alertmanager);

  // @TODO
  const addToK8sApi = useAsync(
    async ({
      partialRoute,
      referenceRouteIdentifier,
      insertPosition,
    }: {
      partialRoute: Partial<FormAmRoute>;
      referenceRouteIdentifier: string;
      insertPosition: InsertPosition;
    }) => {}
  );

  const addToAlertmanagerConfiguration = useAsync(
    async ({
      partialRoute,
      referenceRouteIdentifier,
      insertPosition,
    }: {
      partialRoute: Partial<FormAmRoute>;
      referenceRouteIdentifier: string;
      insertPosition: InsertPosition;
    }) => {
      const action = addRouteAction({
        partialRoute,
        referenceRouteIdentifier,
        insertPosition,
        selectedAlertmanager: alertmanager,
      });
      return produceNewAlertmanagerConfiguration(action);
    }
  );

  return k8sApiSupported ? addToK8sApi : addToAlertmanagerConfiguration;
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

// function routeToK8sSubRoute(route: Route): ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route {
//   const { object_matchers, ...rest } = route;
//   return {
//     ...rest,
//     receiver: route.receiver ?? undefined,
//     matchers: object_matchers?.map(([label, type, value]) => ({
//       label,
//       type,
//       value,
//     })),
//     routes: route.routes?.map(routeToK8sSubRoute),
//   };
// }
