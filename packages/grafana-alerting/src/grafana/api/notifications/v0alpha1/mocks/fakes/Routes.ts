import { faker } from '@faker-js/faker';
import { Factory } from 'fishery';

import {
  API_GROUP,
  API_VERSION,
  ListRoutingTreeApiResponse,
  RoutingTree,
} from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';

import { LabelMatcher } from '../../../../../matchers/types';
import { DEFAULT_NAMESPACE, generateResourceVersion } from '../../../../../mocks/util';
import { USER_DEFINED_TREE_NAME } from '../../../../../notificationPolicies/consts';
import { Route } from '../../../../../notificationPolicies/types';

export const LabelMatcherFactory = Factory.define<LabelMatcher>(() => {
  const operators: Array<LabelMatcher['type']> = ['=', '!=', '=~', '!~'];

  return {
    label: faker.helpers.arrayElement(['service', 'env', 'team', 'severity', 'region', 'instance']),
    type: faker.helpers.arrayElement(operators),
    value: faker.helpers.arrayElement(['web', 'api', 'prod', 'staging', 'critical', 'warning', 'us-east', 'us-west']),
  };
});

export const RouteFactory = Factory.define<Route>(() => ({
  continue: faker.datatype.boolean(),
  receiver: faker.helpers.arrayElement(['web-team', 'api-team', 'critical-alerts', 'dev-team']),
  matchers: LabelMatcherFactory.buildList(faker.number.int({ min: 1, max: 3 })),
  group_by: faker.helpers.arrayElements(['alertname', 'service', 'severity'], { min: 1, max: 2 }),
  group_wait: faker.helpers.arrayElement(['10s', '30s', '1m']),
  group_interval: faker.helpers.arrayElement(['5m', '10m', '15m']),
  repeat_interval: faker.helpers.arrayElement(['1h', '4h', '12h']),
  active_time_intervals: faker.helpers.arrayElements(['business-hours', 'weekends', 'maintenance'], { min: 1, max: 2 }),
  mute_time_intervals: faker.helpers.arrayElements(['lunch-break', 'night-hours'], { min: 1, max: 2 }),
  routes: [],
}));

export const RoutingTreeFactory = Factory.define<RoutingTree>(({ sequence }) => {
  const name = sequence === 1 ? USER_DEFINED_TREE_NAME : `policy-tree-${sequence}`;

  return {
    kind: 'RoutingTree',
    apiVersion: `${API_GROUP}/${API_VERSION}`,
    metadata: {
      name,
      namespace: DEFAULT_NAMESPACE,
      resourceVersion: generateResourceVersion(),
    },
    spec: {
      defaults: {
        receiver: faker.helpers.arrayElement(['web-team', 'api-team', 'critical-alerts', 'dev-team']),
        group_by: ['alertname'],
        group_wait: '30s',
        group_interval: '5m',
        repeat_interval: '4h',
      },
      routes: [],
    },
  };
});

export const ListRoutingTreeApiResponseFactory = Factory.define<ListRoutingTreeApiResponse>(() => ({
  kind: 'RoutingTreeList',
  apiVersion: `${API_GROUP}/${API_VERSION}`,
  metadata: {
    resourceVersion: generateResourceVersion(),
  },
  items: RoutingTreeFactory.buildList(3),
}));
