import { MatcherOperator, Route } from 'app/plugins/datasource/alertmanager/types';

import { ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route } from '../openapi/routesApi.gen';

import { k8sSubRouteToRoute, routeToK8sSubRoute } from './routesApi';

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
    name: 'test-name',
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
        name: 'test-name',
        receiver: 'receiver2',
        matchers: undefined,
        object_matchers: [['label2', MatcherOperator.notEqual, 'value2']],
        routes: undefined,
      },
    ],
  };

  expect(k8sSubRouteToRoute(input, 'test-name')).toStrictEqual(expected);
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
