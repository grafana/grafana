import { faker } from '@faker-js/faker';
import { Factory } from 'fishery';

import { LabelMatcher } from '../../../../../matchers/types';
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
