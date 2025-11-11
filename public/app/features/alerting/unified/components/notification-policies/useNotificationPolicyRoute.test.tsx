import { MatcherOperator, ROUTES_META_SYMBOL, Route } from 'app/plugins/datasource/alertmanager/types';

import { ROOT_ROUTE_NAME } from '../../utils/k8s/constants';

import { createKubernetesRoutingTreeSpec } from './useNotificationPolicyRoute';

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
