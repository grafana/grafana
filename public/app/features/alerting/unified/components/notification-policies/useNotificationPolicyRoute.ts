import { pick } from 'lodash';
import memoize from 'micro-memoize';

import { BaseAlertmanagerArgs, Skippable } from 'app/features/alerting/unified/types/hooks';
import { MatcherOperator, ROUTES_META_SYMBOL, Route } from 'app/plugins/datasource/alertmanager/types';

import { getAPINamespace } from '../../../../../api/utils';
import { alertmanagerApi } from '../../api/alertmanagerApi';
import { useAsync } from '../../hooks/useAsync';
import { useProduceNewAlertmanagerConfiguration } from '../../hooks/useProduceNewAlertmanagerConfig';
import {
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route,
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RouteDefaults,
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree,
  generatedRoutesApi as routingTreeApi,
} from '../../openapi/routesApi.gen';
import {
  addRouteAction,
  deleteRouteAction,
  updateRouteAction,
} from '../../reducers/alertmanager/notificationPolicyRoutes';
import { FormAmRoute } from '../../types/amroutes';
import { addUniqueIdentifierToRoute } from '../../utils/amroutes';
import { PROVENANCE_NONE, ROOT_ROUTE_NAME } from '../../utils/k8s/constants';
import { isK8sEntityProvisioned, shouldUseK8sApi } from '../../utils/k8s/utils';
import { INHERITABLE_KEYS, InheritableProperties } from '../../utils/notification-policies';
import {
  InsertPosition,
  addRouteToReferenceRoute,
  cleanKubernetesRouteIDs,
  mergePartialAmRouteWithRouteTree,
  omitRouteFromRouteTree,
} from '../../utils/routeTree';

const k8sRoutesToRoutesMemoized = memoize(k8sRoutesToRoutes, { maxSize: 1 });

const {
  useListNamespacedRoutingTreeQuery,
  useReplaceNamespacedRoutingTreeMutation,
  useLazyListNamespacedRoutingTreeQuery,
} = routingTreeApi;

const { useGetAlertmanagerConfigurationQuery } = alertmanagerApi;

export const useNotificationPolicyRoute = ({ alertmanager }: BaseAlertmanagerArgs, { skip }: Skippable = {}) => {
  const k8sApiSupported = shouldUseK8sApi(alertmanager);

  const k8sRouteQuery = useListNamespacedRoutingTreeQuery(
    { namespace: getAPINamespace() },
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
    [ROUTES_META_SYMBOL]: {
      provisioned: Boolean(route.provenance && route.provenance !== PROVENANCE_NONE),
    },
  };
});

export function useUpdateExistingNotificationPolicy({ alertmanager }: BaseAlertmanagerArgs) {
  const k8sApiSupported = shouldUseK8sApi(alertmanager);
  const [updatedNamespacedRoute] = useReplaceNamespacedRoutingTreeMutation();
  const [produceNewAlertmanagerConfiguration] = useProduceNewAlertmanagerConfiguration();
  const [listNamespacedRoutingTree] = useLazyListNamespacedRoutingTreeQuery();

  const updateUsingK8sApi = useAsync(async (update: Partial<FormAmRoute>) => {
    const namespace = getAPINamespace();
    const result = await listNamespacedRoutingTree({ namespace });

    const [rootTree] = result.data ? k8sRoutesToRoutesMemoized(result.data.items) : [];
    if (!rootTree) {
      throw new Error(`no root route found for namespace ${namespace}`);
    }

    const rootRouteWithIdentifiers = addUniqueIdentifierToRoute(rootTree);
    const newRouteTree = mergePartialAmRouteWithRouteTree(alertmanager, update, rootRouteWithIdentifiers);

    // Create the K8s route object
    const routeObject = createKubernetesRoutingTreeSpec(newRouteTree);

    return updatedNamespacedRoute({
      name: ROOT_ROUTE_NAME,
      namespace,
      comGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree: cleanKubernetesRouteIDs(routeObject),
    }).unwrap();
  });

  const updateFromAlertmanagerConfiguration = useAsync(async (update: Partial<FormAmRoute>) => {
    const action = updateRouteAction({ update, alertmanager });
    return produceNewAlertmanagerConfiguration(action);
  });

  return k8sApiSupported ? updateUsingK8sApi : updateFromAlertmanagerConfiguration;
}

export function useDeleteNotificationPolicy({ alertmanager }: BaseAlertmanagerArgs) {
  const k8sApiSupported = shouldUseK8sApi(alertmanager);
  const [produceNewAlertmanagerConfiguration] = useProduceNewAlertmanagerConfiguration();
  const [listNamespacedRoutingTree] = useLazyListNamespacedRoutingTreeQuery();
  const [updatedNamespacedRoute] = useReplaceNamespacedRoutingTreeMutation();

  const deleteFromK8sApi = useAsync(async (id: string) => {
    const namespace = getAPINamespace();
    const result = await listNamespacedRoutingTree({ namespace });

    const [rootTree] = result.data ? k8sRoutesToRoutesMemoized(result.data.items) : [];
    if (!rootTree) {
      throw new Error(`no root route found for namespace ${namespace}`);
    }

    const rootRouteWithIdentifiers = addUniqueIdentifierToRoute(rootTree);
    const newRouteTree = omitRouteFromRouteTree(id, rootRouteWithIdentifiers);

    // Create the K8s route object
    const routeObject = createKubernetesRoutingTreeSpec(newRouteTree);

    return updatedNamespacedRoute({
      name: ROOT_ROUTE_NAME,
      namespace,
      comGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree: routeObject,
    }).unwrap();
  });

  const deleteFromAlertmanagerConfiguration = useAsync(async (id: string) => {
    const action = deleteRouteAction({ id });
    return produceNewAlertmanagerConfiguration(action);
  });

  return k8sApiSupported ? deleteFromK8sApi : deleteFromAlertmanagerConfiguration;
}

export function useAddNotificationPolicy({ alertmanager }: BaseAlertmanagerArgs) {
  const k8sApiSupported = shouldUseK8sApi(alertmanager);
  const [produceNewAlertmanagerConfiguration] = useProduceNewAlertmanagerConfiguration();
  const [listNamespacedRoutingTree] = useLazyListNamespacedRoutingTreeQuery();
  const [updatedNamespacedRoute] = useReplaceNamespacedRoutingTreeMutation();

  const addToK8sApi = useAsync(
    async ({
      partialRoute,
      referenceRouteIdentifier,
      insertPosition,
    }: {
      partialRoute: Partial<FormAmRoute>;
      referenceRouteIdentifier: string;
      insertPosition: InsertPosition;
    }) => {
      const namespace = getAPINamespace();
      const result = await listNamespacedRoutingTree({ namespace });

      const [rootTree] = result.data ? k8sRoutesToRoutesMemoized(result.data.items) : [];
      if (!rootTree) {
        throw new Error(`no root route found for namespace ${namespace}`);
      }

      const rootRouteWithIdentifiers = addUniqueIdentifierToRoute(rootTree);
      const newRouteTree = addRouteToReferenceRoute(
        alertmanager ?? '',
        partialRoute,
        referenceRouteIdentifier,
        rootRouteWithIdentifiers,
        insertPosition
      );

      // Create the K8s route object
      const routeObject = createKubernetesRoutingTreeSpec(newRouteTree);

      return updatedNamespacedRoute({
        name: ROOT_ROUTE_NAME,
        namespace,
        comGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree: cleanKubernetesRouteIDs(routeObject),
      }).unwrap();
    }
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
        alertmanager,
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
      [ROUTES_META_SYMBOL]: {
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

export function k8sSubRouteToRoute(route: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route): Route {
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

export function routeToK8sSubRoute(route: Route): ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route {
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

/**
 * Convert Route to K8s compatible format. Make sure we aren't sending any additional properties the API doesn't recognize
 * because it will reply with excess properties in the HTTP headers
 */
export function createKubernetesRoutingTreeSpec(
  rootRoute: Route
): ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree {
  const inheritableDefaultProperties: InheritableProperties = pick(rootRoute, INHERITABLE_KEYS);

  const defaults: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RouteDefaults = {
    ...inheritableDefaultProperties,
    // TODO: Fix types in k8s API? Fix our types to not allow empty receiver? TBC
    receiver: rootRoute.receiver ?? '',
  };

  const routes = rootRoute.routes?.map(routeToK8sSubRoute) ?? [];

  const spec = {
    defaults,
    routes,
  };

  return {
    spec: spec,
    metadata: {
      name: ROOT_ROUTE_NAME,
      resourceVersion: rootRoute[ROUTES_META_SYMBOL]?.resourceVersion,
    },
  };
}
