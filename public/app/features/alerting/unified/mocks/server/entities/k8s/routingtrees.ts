import {
  API_GROUP,
  API_VERSION,
  RoutingTree,
  RoutingTreeMatcher,
  RoutingTreeRoute,
  RoutingTreeSpec,
} from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import grafanaAlertmanagerConfig from 'app/features/alerting/unified/mocks/server/entities/alertmanager-config/grafana-alertmanager-config';
import { KnownProvenance } from 'app/features/alerting/unified/types/knownProvenance';
import { K8sAnnotations, ROOT_ROUTE_NAME } from 'app/features/alerting/unified/utils/k8s/constants';
import { AlertManagerCortexConfig, MatcherOperator, Route } from 'app/plugins/datasource/alertmanager/types';

/**
 * Normalise matchers from config Route object -> what the k8s API expects to be returning
 */
const normalizeMatchers = (route: Route) => {
  const routeMatchers: RoutingTreeMatcher[] = [];

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

const mapRoute = (route: Route): RoutingTreeRoute => {
  const normalisedMatchers = normalizeMatchers(route);
  const { match, match_re, object_matchers, routes, receiver, ...rest } = route;
  return {
    ...rest,
    continue: rest.continue ?? false,
    // TODO: Fix types in k8s API? Fix our types to not allow empty receiver? TBC
    receiver: receiver || '',
    matchers: normalisedMatchers,
    routes: routes ? routes.map(mapRoute) : undefined,
  };
};

export const getUserDefinedRoutingTree: (config: AlertManagerCortexConfig) => RoutingTree = (config) => {
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

const routingTreeFromSpec: (routeName: string, spec: RoutingTreeSpec, provenance?: string) => RoutingTree = (
  routeName,
  spec,
  provenance = KnownProvenance.None
) => ({
  apiVersion: `${API_GROUP}/${API_VERSION}`,
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
    [
      'Managed Policy - Empty Provisioned',
      routingTreeFromSpec(
        'Managed Policy - Empty Provisioned',
        {
          defaults: {
            receiver: grafanaAlertmanagerConfig?.alertmanager_config?.receivers![0].name, // grafana-default-email
          },
          routes: [],
        },
        'api'
      ),
    ],
    [
      'Managed Policy - Override + Inherit',
      routingTreeFromSpec('Managed Policy - Override + Inherit', {
        defaults: {
          receiver: grafanaAlertmanagerConfig?.alertmanager_config?.receivers![1].name, // provisioned-contact-point
          group_by: ['alertname'],
          group_wait: '1s',
          group_interval: '1m',
          repeat_interval: '1h',
        },
        routes: [
          {
            // Override.
            receiver: grafanaAlertmanagerConfig?.alertmanager_config?.receivers![2].name, // lotsa-emails
            group_by: ['alertname', 'grafana_folder'],
            group_wait: '10s',
            group_interval: '10m',
            repeat_interval: '10h',
            continue: true,
            active_time_intervals: [grafanaAlertmanagerConfig?.alertmanager_config?.time_intervals![0].name], // Some interval
            mute_time_intervals: [grafanaAlertmanagerConfig?.alertmanager_config?.time_intervals![1].name], // A provisioned interval
            matchers: [{ label: 'severity', type: MatcherOperator.equal, value: 'critical' }],
          },
          {
            // Inherit.
            continue: false,
            matchers: [{ label: 'severity', type: MatcherOperator.equal, value: 'warn' }],
          },
        ],
      }),
    ],
    [
      'Managed Policy - Many Top-Level',
      routingTreeFromSpec('Managed Policy - Many Top-Level', {
        defaults: {
          receiver: grafanaAlertmanagerConfig?.alertmanager_config?.receivers![2].name, // lotsa-emails
          group_by: ['alertname'],
          group_wait: '2s',
          group_interval: '2m',
          repeat_interval: '2h',
        },
        routes: [
          // Many top-level routes.
          { continue: false, matchers: [{ label: 'severity', type: MatcherOperator.equal, value: 'warn' }] },
          { continue: false, matchers: [{ label: 'severity', type: MatcherOperator.equal, value: 'critical' }] },
          { continue: false, matchers: [{ label: 'severity', type: MatcherOperator.equal, value: 'info' }] },
          { continue: false, matchers: [{ label: 'severity', type: MatcherOperator.equal, value: 'debug' }] },
          { continue: false, matchers: [{ label: 'severity', type: MatcherOperator.equal, value: 'unknown' }] },
        ],
      }),
    ],
    [
      'Managed Policy - Deeply Nested',
      routingTreeFromSpec('Managed Policy - Deeply Nested', {
        defaults: {
          receiver: grafanaAlertmanagerConfig?.alertmanager_config?.receivers![3].name, // Slack with multiple channels
          group_by: ['...'],
          group_wait: '3s',
          group_interval: '3m',
          repeat_interval: '3h',
        },
        routes: [
          // Deeply nested route.
          {
            continue: false,
            matchers: [{ label: 'level', type: MatcherOperator.equal, value: 'one' }],
            routes: [
              {
                continue: false,
                matchers: [{ label: 'level', type: MatcherOperator.equal, value: 'two' }],
                routes: [
                  {
                    continue: false,
                    matchers: [{ label: 'level', type: MatcherOperator.equal, value: 'three' }],
                    routes: [
                      {
                        continue: false,
                        matchers: [{ label: 'level', type: MatcherOperator.equal, value: 'four' }],
                        routes: [
                          {
                            continue: false,
                            matchers: [{ label: 'level', type: MatcherOperator.equal, value: 'five' }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ],
  ]);

let ROUTING_TREE_MAP = getDefaultRoutingTreeMap();

export const getRoutingTreeList = () => {
  return Array.from(ROUTING_TREE_MAP.values());
};

export const getRoutingTree = (treeName: string) => {
  return ROUTING_TREE_MAP.get(treeName);
};

export const setRoutingTree = (treeName: string, updatedRoutingTree: RoutingTree) => {
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
