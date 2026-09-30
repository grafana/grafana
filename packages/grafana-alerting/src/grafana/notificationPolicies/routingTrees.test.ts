import { RoutingTreeFactory } from '../api/notifications/v1beta1/mocks/fakes/Routes';

import {
  DEFAULT_ROUTING_TREE_NAME_ALIAS,
  USER_DEFINED_TREE_NAME,
  findRoutingTreeByName,
  getRoutingTreeDisplayName,
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

describe('findRoutingTreeByName', () => {
  const defaultTree = RoutingTreeFactory.build({ metadata: { name: USER_DEFINED_TREE_NAME } });
  const namedTree = RoutingTreeFactory.build({ metadata: { name: 'team-backend' } });
  const trees = [namedTree, defaultTree];

  it.each([USER_DEFINED_TREE_NAME, DEFAULT_ROUTING_TREE_NAME_ALIAS, '', undefined])(
    'resolves %p to the default tree, whatever alias it was asked for',
    (name) => {
      expect(findRoutingTreeByName(trees, name)).toBe(defaultTree);
    }
  );

  it('finds a named tree by its exact name', () => {
    expect(findRoutingTreeByName(trees, 'team-backend')).toBe(namedTree);
  });

  it('returns undefined for a name that no tree has', () => {
    expect(findRoutingTreeByName(trees, 'team-does-not-exist')).toBeUndefined();
  });

  it('returns undefined when asked for the default tree but the list has none', () => {
    expect(findRoutingTreeByName([namedTree], '')).toBeUndefined();
  });
});

describe('getRoutingTreeDisplayName', () => {
  // Compare against the user-defined label so the assertion is robust to the i18n fallback string.
  it.each([USER_DEFINED_TREE_NAME, DEFAULT_ROUTING_TREE_NAME_ALIAS, '', undefined])(
    'labels the default tree (%p) as the default policy',
    (name) => {
      expect(getRoutingTreeDisplayName(name)).toBe(getRoutingTreeDisplayName(USER_DEFINED_TREE_NAME));
    }
  );

  it('returns the raw name for a named routing tree', () => {
    expect(getRoutingTreeDisplayName('team-backend')).toBe('team-backend');
  });
});
