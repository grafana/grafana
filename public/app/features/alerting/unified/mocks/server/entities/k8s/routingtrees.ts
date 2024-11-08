import grafanaAlertmanagerConfig from 'app/features/alerting/unified/mocks/server/entities/alertmanager-config/grafana-alertmanager-config';
import {
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Matcher,
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route,
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree,
} from 'app/features/alerting/unified/openapi/routesApi.gen';
import { AlertManagerCortexConfig, MatcherOperator, Route } from 'app/plugins/datasource/alertmanager/types';

const normalizeMatchers = (route: Route) => {
  const routeMatchers: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Matcher[] = [];

  if (route.object_matchers) {
    // todo foreach
    route.object_matchers.map(([label, type, value]) => {
      return { label, type, value };
    });
  }

  if (route.match_re) {
    Object.entries(route.match_re).forEach(([label, value]) => {
      routeMatchers.push({ label, type: MatcherOperator.regex, value });
    });
  }

  if (route.match) {
    Object.entries(route.match).forEach(([label, value]) => {
      routeMatchers.push({ label, type: MatcherOperator.equal, value });
    });
  }

  return routeMatchers;
};

const mapRoute = (route: Route): ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route => {
  const normalisedMatchers = normalizeMatchers(route);
  const { match, match_re, object_matchers, routes, ...rest } = route;
  return {
    ...rest,
    matchers: normalisedMatchers,
    routes: routes ? routes.map(mapRoute) : undefined,
  };
};

export const getUserDefinedRoutingTree: (
  config: AlertManagerCortexConfig
) => ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree = (config) => {
  const route = config.alertmanager_config?.route || {};

  const { routes, ...defaults } = route;

  return {
    metadata: {
      name: 'user-defined',
      namespace: 'default',
      annotations: {
        'grafana.com/provenance': 'none',
      },
    },
    spec: {
      defaults: { group_by: defaults.group_by || [], receiver: defaults.receiver! },
      routes:
        routes?.map((route) => {
          return mapRoute(route);
        }) || [],
    },
  };
};

export const ROUTING_TREE_MAP = new Map([['user-defined', getUserDefinedRoutingTree(grafanaAlertmanagerConfig)]]);
