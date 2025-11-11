import {
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree,
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route,
  generatedRoutesApi,
  ReadNamespacedRoutingTreeApiResponse,
  ListNamespacedRoutingTreeApiResponse,
} from 'app/features/alerting/unified/openapi/routesApi.gen';
import { MatcherOperator, ROUTES_META_SYMBOL, Route } from 'app/plugins/datasource/alertmanager/types';
import { ROOT_ROUTE_NAME } from '../utils/k8s/constants';
import { isK8sEntityProvisioned } from '../utils/k8s/utils';
import { DefinitionsFromApi, OverrideResultType, TagTypesFromApi } from '@reduxjs/toolkit/query';

type Definitions = DefinitionsFromApi<typeof generatedRoutesApi>;
type TagTypes = TagTypesFromApi<typeof generatedRoutesApi>;

type UpdatedDefinitions = Omit<Definitions, 'readNamespacedRoutingTree' | 'listNamespacedRoutingTree'> & {
  readNamespacedRoutingTree: OverrideResultType<Definitions['readNamespacedRoutingTree'], Route>;
  listNamespacedRoutingTree: OverrideResultType<Definitions['listNamespacedRoutingTree'], Route[]>;
};

export const routesApi = generatedRoutesApi.enhanceEndpoints<TagTypes, UpdatedDefinitions>({
  endpoints: {
    readNamespacedRoutingTree: (endpoint) => {
      // We transform the response here instead of in `selectFromResult` so that memoization of the transformed Route
      // is automatically handled.
      endpoint.transformResponse = (response: ReadNamespacedRoutingTreeApiResponse): Route => {
        return k8sRouteToRoute(response);
      };
    },
    listNamespacedRoutingTree: (endpoint) => {
      endpoint.transformResponse = (response: ListNamespacedRoutingTreeApiResponse): Route[] => {
        return k8sRoutesToRoutes(response.items);
      };
    },
  },
});

export const NAMED_ROOT_LABEL_NAME = '__grafana_managed_route__';

function k8sRouteToRoute(route: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree): Route {
  return {
    ...route.spec.defaults,
    name: route.metadata.name,
    routes: route.spec.routes?.map((subroute) => k8sSubRouteToRoute(subroute, route.metadata.name)),
    // This assumes if a `NAMED_ROOT_LABEL_NAME` label exists, it will NOT go to the default route, which is a fair but
    // not perfect assumption since we don't yet protect the label.
    object_matchers:
      route.metadata.name == ROOT_ROUTE_NAME || !route.metadata.name
        ? [[NAMED_ROOT_LABEL_NAME, MatcherOperator.equal, '']]
        : [[NAMED_ROOT_LABEL_NAME, MatcherOperator.equal, route.metadata.name]],
    [ROUTES_META_SYMBOL]: {
      provisioned: isK8sEntityProvisioned(route),
      resourceVersion: route.metadata.resourceVersion,
      name: route.metadata.name,
      metadata: route.metadata,
    },
  };
}

function k8sRoutesToRoutes(routes: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree[]): Route[] {
  return routes?.map((route) => {
    return k8sRouteToRoute(route);
  });
}

/** Helper to provide type safety for matcher operators from API */
function isValidMatcherOperator(type: string): type is MatcherOperator {
  return Object.values<string>(MatcherOperator).includes(type);
}

export function k8sSubRouteToRoute(
  route: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route,
  rootName?: string
): Route {
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
