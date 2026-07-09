import { type RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';

import {
  DEFAULT_ROUTING_TREE_NAME_ALIAS,
  USER_DEFINED_TREE_NAME,
  isDefaultRoutingTree,
  isDefaultRoutingTreeName,
} from './routingTrees';

describe('isDefaultRoutingTreeName', () => {
  it.each([USER_DEFINED_TREE_NAME, DEFAULT_ROUTING_TREE_NAME_ALIAS, '', undefined])(
    'treats %p as the default route name',
    (name) => {
      expect(isDefaultRoutingTreeName(name)).toBe(true);
    }
  );

  it.each(['team-backend', 'user-defined-2', 'Default', 'USER-DEFINED'])(
    'treats %p as a non-default (named) route',
    (name) => {
      expect(isDefaultRoutingTreeName(name)).toBe(false);
    }
  );
});

describe('isDefaultRoutingTree', () => {
  const treeNamed = (name?: string): RoutingTree => ({ metadata: { name } }) as RoutingTree;

  it.each([USER_DEFINED_TREE_NAME, DEFAULT_ROUTING_TREE_NAME_ALIAS, undefined])(
    'is true for the default tree named %p',
    (name) => {
      expect(isDefaultRoutingTree(treeNamed(name))).toBe(true);
    }
  );

  it('is false for a named managed route', () => {
    expect(isDefaultRoutingTree(treeNamed('team-backend'))).toBe(false);
  });
});
