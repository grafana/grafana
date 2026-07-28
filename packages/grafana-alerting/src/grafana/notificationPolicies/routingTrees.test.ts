import { RoutingTreeFactory } from '../api/notifications/v0alpha1/mocks/fakes/Routes';

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
  // The undefined/empty name cases are covered by isDefaultRoutingTreeName above; here we only need
  // to prove the tree-level helper delegates using the tree's metadata.name.
  it.each([USER_DEFINED_TREE_NAME, DEFAULT_ROUTING_TREE_NAME_ALIAS])(
    'is true for the default tree named %p',
    (name) => {
      expect(isDefaultRoutingTree(RoutingTreeFactory.build({ metadata: { name } }))).toBe(true);
    }
  );

  it('is false for a named managed route', () => {
    expect(isDefaultRoutingTree(RoutingTreeFactory.build({ metadata: { name: 'team-backend' } }))).toBe(false);
  });
});
