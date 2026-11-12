import { type RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';

import { countNotificationPolicies } from './notificationConfigCounts';

function tree(name: string, routes: RoutingTree['spec']['routes']): RoutingTree {
  return { metadata: { name }, spec: { defaults: { receiver: 'default' }, routes } } as RoutingTree;
}

describe('countNotificationPolicies', () => {
  it('counts each tree default policy and every nested policy', () => {
    const trees = [
      tree('user-defined', [
        { continue: false, routes: [{ continue: false }, { continue: false, routes: [{ continue: false }] }] },
        { continue: false },
      ]),
      tree('team-a', []),
    ];

    // user-defined: default + 2 top-level + 3 nested = 6; team-a: default = 1
    expect(countNotificationPolicies(trees)).toBe(7);
  });

  it('returns zero when there are no routing trees', () => {
    expect(countNotificationPolicies([])).toBe(0);
  });
});
