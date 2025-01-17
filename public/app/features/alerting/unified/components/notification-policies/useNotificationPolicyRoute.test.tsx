import { MatcherOperator, ROUTES_META_SYMBOL, Route } from 'app/plugins/datasource/alertmanager/types';

import { ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route } from '../../openapi/routesApi.gen';
import { ROOT_ROUTE_NAME } from '../../utils/k8s/constants';

import { createKubernetesRoutingTreeSpec, k8sSubRouteToRoute, routeToK8sSubRoute } from './useNotificationPolicyRoute';

test('k8sSubRouteToRoute', () => {
  const input: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route = {
    continue: false,
    group_by: ['label1'],
    group_interval: '5m',
    group_wait: '30s',
    matchers: [{ label: 'label1', type: '=', value: 'value1' }],
    mute_time_intervals: ['mt-1'],
    receiver: 'my-receiver',
    repeat_interval: '4h',
    routes: [
      {
        receiver: 'receiver2',
        matchers: [{ label: 'label2', type: '!=', value: 'value2' }],
      },
    ],
  };

  const expected: Route = {
    continue: false,
    group_by: ['label1'],
    group_interval: '5m',
    group_wait: '30s',
    matchers: undefined, // matchers -> object_matchers
    object_matchers: [['label1', MatcherOperator.equal, 'value1']],
    mute_time_intervals: ['mt-1'],
    receiver: 'my-receiver',
    repeat_interval: '4h',
    routes: [
      {
        receiver: 'receiver2',
        matchers: undefined,
        object_matchers: [['label2', MatcherOperator.notEqual, 'value2']],
        routes: undefined,
      },
    ],
  };

  expect(k8sSubRouteToRoute(input)).toStrictEqual(expected);
});

test('routeToK8sSubRoute', () => {
  const input: Route = {
    continue: false,
    group_by: ['label1'],
    group_interval: '5m',
    group_wait: '30s',
    matchers: undefined, // matchers -> object_matchers
    object_matchers: [['label1', MatcherOperator.equal, 'value1']],
    mute_time_intervals: ['mt-1'],
    receiver: 'my-receiver',
    repeat_interval: '4h',
    routes: [
      {
        receiver: 'receiver2',
        matchers: undefined,
        object_matchers: [['label2', MatcherOperator.notEqual, 'value2']],
      },
    ],
  };

  const expected: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route = {
    continue: false,
    group_by: ['label1'],
    group_interval: '5m',
    group_wait: '30s',
    matchers: [{ label: 'label1', type: '=', value: 'value1' }],
    mute_time_intervals: ['mt-1'],
    receiver: 'my-receiver',
    repeat_interval: '4h',
    routes: [
      {
        receiver: 'receiver2',
        matchers: [{ label: 'label2', type: '!=', value: 'value2' }],
        routes: undefined,
      },
    ],
  };

  expect(routeToK8sSubRoute(input)).toStrictEqual(expected);
});

test('createKubernetesRoutingTreeSpec', () => {
  const route: Route = {
    continue: true,
    group_by: ['alertname'],
    matchers: undefined,
    object_matchers: [['severity', MatcherOperator.equal, 'critical']],
    mute_time_intervals: ['interval-1'],
    receiver: 'default-receiver',
    repeat_interval: '4h',
    routes: [
      {
        continue: false,
        receiver: 'nested-receiver',
        object_matchers: [['team', MatcherOperator.equal, 'frontend']],
        group_wait: '30s',
        group_interval: '5m',
      },
    ],
    [ROUTES_META_SYMBOL]: {
      resourceVersion: 'abc123',
    },
  };

  const tree = createKubernetesRoutingTreeSpec(route);

  expect(tree.metadata.name).toBe(ROOT_ROUTE_NAME);
  expect(tree).toMatchSnapshot();
});
