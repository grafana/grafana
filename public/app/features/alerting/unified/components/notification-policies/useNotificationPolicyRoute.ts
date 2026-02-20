import uFuzzy from '@leeoniya/ufuzzy';
import { pick, uniq } from 'lodash';
import memoize from 'micro-memoize';
import { useMemo } from 'react';

import { INHERITABLE_KEYS, type InheritableProperties } from '@grafana/alerting/internal';
import {
  API_GROUP,
  API_VERSION,
  RoutingTree,
  RoutingTreeRoute,
  RoutingTreeRouteDefaults,
  generatedAPI as routingTreeApi,
} from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { BaseAlertmanagerArgs, Skippable } from 'app/features/alerting/unified/types/hooks';
import { MatcherOperator, ROUTES_META_SYMBOL, Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { useAsync } from '../../hooks/useAsync';
import { useProduceNewAlertmanagerConfiguration } from '../../hooks/useProduceNewAlertmanagerConfig';
import {
  addRouteAction,
  deleteRouteAction,
  updateRouteAction,
} from '../../reducers/alertmanager/notificationPolicyRoutes';
import { FormAmRoute } from '../../types/amroutes';
import { addUniqueIdentifierToRoute } from '../../utils/amroutes';
import { K8sAnnotations, ROOT_ROUTE_NAME } from '../../utils/k8s/constants';
import { getAnnotation, isProvisionedResource, shouldUseK8sApi } from '../../utils/k8s/utils';
import { routeAdapter } from '../../utils/routeAdapter';
import {
  InsertPosition,
  addRouteToReferenceRoute,
  cleanKubernetesRouteIDs,
  mergePartialAmRouteWithRouteTree,
  omitRouteFromRouteTree,
} from '../../utils/routeTree';

export function isRouteProvisioned(route: Route): boolean {
  const provenance = route[ROUTES_META_SYMBOL]?.provenance ?? route.provenance;
  return isProvisionedResource(provenance);
}

const {
  useCreateRoutingTreeMutation,
  useDeleteRoutingTreeMutation,
  useListRoutingTreeQuery,
  useReplaceRoutingTreeMutation,
  useLazyGetRoutingTreeQuery,
  useGetRoutingTreeQuery,
} = routingTreeApi;

const { useGetAlertmanagerConfigurationQuery } = alertmanagerApi;

const memoK8sRouteToRoute = memoize(k8sRouteToRoute);

export const useNotificationPolicyRoute = (
  { alertmanager }: BaseAlertmanagerArgs,
  routeName: string = ROOT_ROUTE_NAME,
  { skip }: Skippable = {}
) => {
  const k8sApiSupported = shouldUseK8sApi(alertmanager);

  const k8sRouteQuery = useGetRoutingTreeQuery(
    { name: routeName },
    {
      skip: skip || !k8sApiSupported,
      selectFromResult: (result) => {
        const { data, currentData, ...rest } = result;

        return {
          ...rest,
          data: data ? memoK8sRouteToRoute(data) : data,
          currentData: currentData ? memoK8sRouteToRoute(currentData) : currentData,
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
          ? parseAmConfigRoute(result.currentData.alertmanager_config.route)
          : undefined,
        data: result.data?.alertmanager_config?.route
          ? parseAmConfigRoute(result.data.alertmanager_config.route)
          : undefined,
      };
    },
  });

  return k8sApiSupported ? k8sRouteQuery : amConfigQuery;
};

export const useListNotificationPolicyRoutes = ({ skip }: Skippable = {}) => {
  return useListRoutingTreeQuery(
    {},
    {
      skip: skip,
      selectFromResult: (result) => {
        const { data, currentData, ...rest } = result;

        return {
          ...rest,
          data: data ? data.items.map(memoK8sRouteToRoute) : data,
          currentData: currentData ? currentData.items.map(memoK8sRouteToRoute) : currentData,
        };
      },
    }
  );
};

const parseAmConfigRoute = memoize((route: Route): Route => {
  return {
    ...route,
    [ROUTES_META_SYMBOL]: {
      provenance: route.provenance,
    },
  };
});

export function useUpdateExistingNotificationPolicy({ alertmanager }: BaseAlertmanagerArgs) {
  const k8sApiSupported = shouldUseK8sApi(alertmanager);
  const [updatedNamespacedRoute] = useReplaceRoutingTreeMutation();
  const [produceNewAlertmanagerConfiguration] = useProduceNewAlertmanagerConfiguration();
  const [readRoutingTree] = useLazyGetRoutingTreeQuery();

  const updateUsingK8sApi = useAsync(async (update: Partial<FormAmRoute>) => {
    const name = update.name ?? ROOT_ROUTE_NAME;
    const result = await readRoutingTree({ name });

    const rootTree = result.data;
    if (!rootTree) {
      throw new Error(`no root route found for name ${name}`);
    }

    const rootRouteWithIdentifiers = addUniqueIdentifierToRoute(k8sRouteToRoute(rootTree));
    const newRouteTree = mergePartialAmRouteWithRouteTree(alertmanager, update, rootRouteWithIdentifiers);

    // Create the K8s route object
    const routeObject = createKubernetesRoutingTreeSpec(newRouteTree);

    return updatedNamespacedRoute({
      name: name,
      routingTree: cleanKubernetesRouteIDs(routeObject),
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
  const [readRoutingTree] = useLazyGetRoutingTreeQuery();
  const [updatedNamespacedRoute] = useReplaceRoutingTreeMutation();

  const deleteFromK8sApi = useAsync(async (route: RouteWithID) => {
    const name = route.name ?? ROOT_ROUTE_NAME;
    const result = await readRoutingTree({ name });

    const rootTree = result.data;
    if (!rootTree) {
      throw new Error(`no root route found for name ${name}`);
    }

    const rootRouteWithIdentifiers = addUniqueIdentifierToRoute(k8sRouteToRoute(rootTree));
    const newRouteTree = omitRouteFromRouteTree(route.id, rootRouteWithIdentifiers);

    // Create the K8s route object
    const routeObject = createKubernetesRoutingTreeSpec(newRouteTree);

    return updatedNamespacedRoute({
      name: name,
      routingTree: routeObject,
    }).unwrap();
  });

  const deleteFromAlertmanagerConfiguration = useAsync(async (route: RouteWithID) => {
    const action = deleteRouteAction({ id: route.id });
    return produceNewAlertmanagerConfiguration(action);
  });

  return k8sApiSupported ? deleteFromK8sApi : deleteFromAlertmanagerConfiguration;
}

export function useAddNotificationPolicy({ alertmanager }: BaseAlertmanagerArgs) {
  const k8sApiSupported = shouldUseK8sApi(alertmanager);
  const [produceNewAlertmanagerConfiguration] = useProduceNewAlertmanagerConfiguration();
  const [readRoutingTree] = useLazyGetRoutingTreeQuery();
  const [updatedNamespacedRoute] = useReplaceRoutingTreeMutation();

  const addToK8sApi = useAsync(
    async ({
      partialRoute,
      referenceRoute,
      insertPosition,
    }: {
      partialRoute: Partial<FormAmRoute>;
      referenceRoute: RouteWithID;
      insertPosition: InsertPosition;
    }) => {
      const name = referenceRoute.name ?? ROOT_ROUTE_NAME;
      const result = await readRoutingTree({ name: name });

      const rootTree = result.data;
      if (!rootTree) {
        throw new Error(`no root route found for name ${name}`);
      }

      const rootRouteWithIdentifiers = addUniqueIdentifierToRoute(k8sRouteToRoute(rootTree));
      const newRouteTree = addRouteToReferenceRoute(
        alertmanager ?? '',
        partialRoute,
        referenceRoute.id,
        rootRouteWithIdentifiers,
        insertPosition
      );

      // Create the K8s route object
      const routeObject = createKubernetesRoutingTreeSpec(newRouteTree);

      return updatedNamespacedRoute({
        name: name,
        routingTree: cleanKubernetesRouteIDs(routeObject),
      }).unwrap();
    }
  );

  const addToAlertmanagerConfiguration = useAsync(
    async ({
      partialRoute,
      referenceRoute,
      insertPosition,
    }: {
      partialRoute: Partial<FormAmRoute>;
      referenceRoute: RouteWithID;
      insertPosition: InsertPosition;
    }) => {
      const action = addRouteAction({
        partialRoute,
        referenceRouteIdentifier: referenceRoute.id,
        insertPosition,
        alertmanager,
      });
      return produceNewAlertmanagerConfiguration(action);
    }
  );

  return k8sApiSupported ? addToK8sApi : addToAlertmanagerConfiguration;
}

type DeleteRoutingTreeArgs = { name: string; resourceVersion?: string };
export function useDeleteRoutingTree() {
  const [deleteRoutingTree] = useDeleteRoutingTreeMutation();

  return useAsync(async ({ name }: DeleteRoutingTreeArgs) => {
    return deleteRoutingTree({ name }).unwrap();
  });
}

export function useCreateRoutingTree() {
  const [createRoutingTree] = useCreateRoutingTreeMutation();

  return useAsync(async (partialFormRoute: Partial<FormAmRoute>) => {
    const {
      name,
      overrideGrouping,
      groupBy,
      overrideTimings,
      groupWaitValue,
      groupIntervalValue,
      repeatIntervalValue,
      receiver,
    } = partialFormRoute;

    // This does not "inherit" from any existing route, as this is a new routing tree. If not set, it will use the system
    // defaults. Currently supported by group_by, group_wait, group_interval, and repeat_interval
    const USE_DEFAULTS = undefined;

    const newRoute: Route = {
      name: name,
      group_by: overrideGrouping ? groupBy : USE_DEFAULTS,
      group_wait: overrideTimings && groupWaitValue ? groupWaitValue : USE_DEFAULTS,
      group_interval: overrideTimings && groupIntervalValue ? groupIntervalValue : USE_DEFAULTS,
      repeat_interval: overrideTimings && repeatIntervalValue ? repeatIntervalValue : USE_DEFAULTS,
      receiver: receiver,
    };

    // defaults(newRoute, TIMING_OPTIONS_DEFAULTS)

    // Create the K8s route object
    const routeObject = createKubernetesRoutingTreeSpec(newRoute);

    return createRoutingTree({
      routingTree: cleanKubernetesRouteIDs(routeObject),
    }).unwrap();
  });
}

const fuzzyFinder = new uFuzzy({
  intraMode: 1,
  intraIns: 1,
  intraSub: 1,
  intraDel: 1,
  intraTrn: 1,
});

export const useRootRouteSearch = (policies: Route[], search?: string | null): Route[] => {
  const nameHaystack = useMemo(() => {
    return policies.map((policy) => policy.name ?? '');
  }, [policies]);

  const receiverHaystack = useMemo(() => {
    return policies.map((policy) => policy.receiver ?? '');
  }, [policies]);

  if (!search) {
    return policies;
  }

  const nameHits = fuzzyFinder.filter(nameHaystack, search) ?? [];
  const typeHits = fuzzyFinder.filter(receiverHaystack, search) ?? [];

  const hits = [...nameHits, ...typeHits];

  return uniq(hits).map((id) => policies[id]) ?? [];
};

/**
 * Convert Route to K8s compatible format. Make sure we aren't sending any additional properties the API doesn't recognize
 * because it will reply with excess properties in the HTTP headers
 */
export function createKubernetesRoutingTreeSpec(rootRoute: Route): RoutingTree {
  const inheritableDefaultProperties: InheritableProperties = pick(routeAdapter.toPackage(rootRoute), INHERITABLE_KEYS);

  const name = rootRoute.name ?? ROOT_ROUTE_NAME;

  const defaults: RoutingTreeRouteDefaults = {
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
    apiVersion: `${API_GROUP}/${API_VERSION}`,
    kind: 'RoutingTree',
    spec: spec,
    metadata: {
      name: name,
      resourceVersion: rootRoute[ROUTES_META_SYMBOL]?.resourceVersion,
    },
  };
}

export const NAMED_ROOT_LABEL_NAME = '__grafana_managed_route__';

export function k8sRouteToRoute(route: RoutingTree): Route {
  return {
    ...route.spec.defaults,
    name: route.metadata.name,
    routes: route.spec.routes?.map((subroute) => k8sSubRouteToRoute(subroute, route.metadata.name)),
    // This assumes if a `NAMED_ROOT_LABEL_NAME` label exists, it will NOT go to the default route, which is a fair but
    // not perfect assumption since we don't yet protect the label.
    object_matchers:
      route.metadata.name === ROOT_ROUTE_NAME || !route.metadata.name
        ? [[NAMED_ROOT_LABEL_NAME, MatcherOperator.equal, '']]
        : [[NAMED_ROOT_LABEL_NAME, MatcherOperator.equal, route.metadata.name]],
    [ROUTES_META_SYMBOL]: {
      provenance: getAnnotation(route, K8sAnnotations.Provenance),
      resourceVersion: route.metadata.resourceVersion,
      name: route.metadata.name,
      metadata: route.metadata,
    },
    provenance: getAnnotation(route, K8sAnnotations.Provenance),
  };
}

/** Helper to provide type safety for matcher operators from API */
function isValidMatcherOperator(type: string): type is MatcherOperator {
  return Object.values<string>(MatcherOperator).includes(type);
}

export function k8sSubRouteToRoute(route: RoutingTreeRoute, rootName?: string): Route {
  return {
    ...route,
    name: rootName,
    routes: route.routes?.map((subroute) => k8sSubRouteToRoute(subroute, rootName)),
    matchers: undefined,
    object_matchers: route.matchers?.map(({ label, type, value }) => {
      if (!isValidMatcherOperator(type)) {
        throw new Error(`Invalid matcher operator from API: ${type}`);
      }
      return [label, type, value];
    }),
  };
}

export function routeToK8sSubRoute(route: Route): RoutingTreeRoute {
  const { object_matchers, ...rest } = route;
  return {
    ...rest,
    continue: route.continue ?? false,
    receiver: route.receiver ?? undefined,
    matchers: object_matchers?.map(([label, type, value]) => ({
      label,
      type,
      value,
    })),
    routes: route.routes?.map(routeToK8sSubRoute),
  };
}
