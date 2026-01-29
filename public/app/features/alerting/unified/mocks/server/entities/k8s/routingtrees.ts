import grafanaAlertmanagerConfig from 'app/features/alerting/unified/mocks/server/entities/alertmanager-config/grafana-alertmanager-config';
import {
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Matcher,
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route,
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree,
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTreeSpec,
} from 'app/features/alerting/unified/openapi/routesApi.gen';
import { KnownProvenance } from 'app/features/alerting/unified/types/knownProvenance';
import { K8sAnnotations, ROOT_ROUTE_NAME } from 'app/features/alerting/unified/utils/k8s/constants';
import { AlertManagerCortexConfig, MatcherOperator, Route } from 'app/plugins/datasource/alertmanager/types';

/**
 * Normalise matchers from config Route object -> what the k8s API expects to be returning
 */
const normalizeMatchers = (route: Route) => {
  const routeMatchers: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Matcher[] = [];

  if (route.object_matchers) {
    route.object_matchers.forEach(([label, type, value]) => {
      routeMatchers.push({ label, type, value });
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
  const { match, match_re, object_matchers, routes, receiver, ...rest } = route;
  return {
    ...rest,
    // TODO: Fix types in k8s API? Fix our types to not allow empty receiver? TBC
    receiver: receiver || '',
    matchers: normalisedMatchers,
    routes: routes ? routes.map(mapRoute) : undefined,
  };
};

export const getUserDefinedRoutingTree: (
  config: AlertManagerCortexConfig
) => ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree = (config) => {
  const route = config.alertmanager_config?.route || {};

  const { routes, ...defaults } = route;

  const spec = {
    defaults: { ...defaults, group_by: defaults.group_by || [], receiver: defaults.receiver || '' },
    routes:
      routes?.map((route) => {
        return mapRoute(route);
      }) || [],
  };

  return routingTreeFromSpec(ROOT_ROUTE_NAME, spec);
};

const routingTreeFromSpec: (
  routeName: string,
  spec: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTreeSpec,
  provenance?: string,
) => ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree = (routeName, spec, provenance = KnownProvenance.None) => ({
  kind: 'RoutingTree',
  metadata: {
    name: routeName,
    namespace: 'default',
    annotations: {
      [K8sAnnotations.Provenance]: provenance,
    },
    // Resource versions are much shorter than this in reality, but this is an easy way
    // for us to mock the concurrency logic and check if the policies have updated since the last fetch
    resourceVersion: btoa(JSON.stringify(spec)),
  },
  spec: spec,
});

const getDefaultRoutingTreeMap = () =>
  new Map([
    [ROOT_ROUTE_NAME, getUserDefinedRoutingTree(grafanaAlertmanagerConfig)],
    ['Managed Policy - Empty Provisioned', routingTreeFromSpec("Managed Policy - Empty Provisioned", {
      defaults: {
        receiver: grafanaAlertmanagerConfig?.alertmanager_config?.receivers![0].name, // grafana-default-email
      },
      routes: [],
    }, 'api')],
    ['Managed Policy - Override + Inherit', routingTreeFromSpec("Managed Policy - Override + Inherit", {
      defaults: {
        receiver: grafanaAlertmanagerConfig?.alertmanager_config?.receivers![1].name, // provisioned-contact-point
        group_by: ['alertname'],
        group_wait: '1s',
        group_interval: '1m',
        repeat_interval: '1h'
      },
      routes: [{ // Override.
        receiver: grafanaAlertmanagerConfig?.alertmanager_config?.receivers![2].name, // lotsa-emails
        group_by: ['alertname', 'grafana_folder'],
        group_wait: '10s',
        group_interval: '10m',
        repeat_interval: '10h',
        continue: true,
        active_time_intervals: [grafanaAlertmanagerConfig?.alertmanager_config?.time_intervals![0].name], // Some interval
        mute_time_intervals: [grafanaAlertmanagerConfig?.alertmanager_config?.time_intervals![1].name], // A provisioned interval
        matchers: [
          { label: 'severity', type: MatcherOperator.equal, value: 'critical' },
        ],
      }, { // Inherit.
        matchers: [
          { label: 'severity', type: MatcherOperator.equal, value: 'warn' },
        ],
      }],
    })],
    ['Managed Policy - Many Top-Level', routingTreeFromSpec("Managed Policy - Many Top-Level", {
      defaults: {
        receiver: grafanaAlertmanagerConfig?.alertmanager_config?.receivers![2].name, // lotsa-emails
        group_by: ['alertname'],
        group_wait: '2s',
        group_interval: '2m',
        repeat_interval: '2h'
      },
      routes: [ // Many top-level routes.
        { matchers: [{ label: 'severity', type: MatcherOperator.equal, value: 'warn' }] },
        { matchers: [{ label: 'severity', type: MatcherOperator.equal, value: 'critical' }] },
        { matchers: [{ label: 'severity', type: MatcherOperator.equal, value: 'info' }] },
        { matchers: [{ label: 'severity', type: MatcherOperator.equal, value: 'debug' }] },
        { matchers: [{ label: 'severity', type: MatcherOperator.equal, value: 'unknown' }] },
      ],
    })],
    ['Managed Policy - Deeply Nested', routingTreeFromSpec("Managed Policy - Deeply Nested", {
      defaults: {
        receiver: grafanaAlertmanagerConfig?.alertmanager_config?.receivers![3].name, // Slack with multiple channels
        group_by: ['...'],
        group_wait: '3s',
        group_interval: '3m',
        repeat_interval: '3h'
      },
      routes: [ // Deeply nested route.
        {
          matchers: [{ label: 'level', type: MatcherOperator.equal, value: 'one' }],
          routes: [{
              matchers: [{ label: 'level', type: MatcherOperator.equal, value: 'two' }],
              routes: [{
                  matchers: [{ label: 'level', type: MatcherOperator.equal, value: 'three' }],
                  routes: [{
                      matchers: [{ label: 'level', type: MatcherOperator.equal, value: 'four' }],
                      routes: [{
                          matchers: [{ label: 'level', type: MatcherOperator.equal, value: 'five' }],
                        }],
                    }],
                }],
            }]
        }],
    })],
  ]);

let ROUTING_TREE_MAP = getDefaultRoutingTreeMap();

export const getRoutingTreeList = () => {
  return Array.from(ROUTING_TREE_MAP.values());
};

export const getRoutingTree = (treeName: string) => {
  return ROUTING_TREE_MAP.get(treeName);
};

export const setRoutingTree = (
  treeName: string,
  updatedRoutingTree: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree
) => {
  return ROUTING_TREE_MAP.set(treeName, updatedRoutingTree);
};

export const deleteRoutingTree = (treeName: string) => {
  return ROUTING_TREE_MAP.delete(treeName);
};

export const resetDefaultRoutingTree = () => {
  ROUTING_TREE_MAP.set(ROOT_ROUTE_NAME, getUserDefinedRoutingTree(grafanaAlertmanagerConfig));
};

export const resetRoutingTreeMap = () => {
  ROUTING_TREE_MAP = getDefaultRoutingTreeMap();
};
