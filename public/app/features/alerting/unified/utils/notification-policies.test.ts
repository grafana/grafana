import { MatcherOperator, Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { findMatchingRoutes, normalizeRoute, getInheritedProperties } from './notification-policies';

import 'core-js/stable/structured-clone';

const CATCH_ALL_ROUTE: Route = {
  receiver: 'ALL',
  object_matchers: [],
};

describe('findMatchingRoutes', () => {
  const policies: Route = {
    receiver: 'ROOT',
    group_by: ['grafana_folder'],
    object_matchers: [],
    routes: [
      {
        receiver: 'A',
        routes: [
          {
            receiver: 'B1',
            object_matchers: [['region', MatcherOperator.equal, 'europe']],
          },
          {
            receiver: 'B2',
            object_matchers: [['region', MatcherOperator.notEqual, 'europe']],
          },
        ],
        object_matchers: [['team', MatcherOperator.equal, 'operations']],
      },
      {
        receiver: 'C',
        object_matchers: [['foo', MatcherOperator.equal, 'bar']],
      },
    ],
    group_wait: '10s',
    group_interval: '1m',
  };

  it('should match root route with no matching labels', () => {
    const matches = findMatchingRoutes(policies, []);
    expect(matches).toHaveLength(1);
    expect(matches[0].route).toHaveProperty('receiver', 'ROOT');
  });

  it('should match parent route with no matching children', () => {
    const matches = findMatchingRoutes(policies, [['team', 'operations']]);
    expect(matches).toHaveLength(1);
    expect(matches[0].route).toHaveProperty('receiver', 'A');
  });

  it('should match child route of matching parent', () => {
    const matches = findMatchingRoutes(policies, [
      ['team', 'operations'],
      ['region', 'europe'],
    ]);
    expect(matches).toHaveLength(1);
    expect(matches[0].route).toHaveProperty('receiver', 'B1');
  });

  it('should match simple policy', () => {
    const matches = findMatchingRoutes(policies, [['foo', 'bar']]);
    expect(matches).toHaveLength(1);
    expect(matches[0].route).toHaveProperty('receiver', 'C');
  });

  it('should match catch-all route', () => {
    const policiesWithAll: Route = {
      ...policies,
      routes: [CATCH_ALL_ROUTE, ...(policies.routes ?? [])],
    };

    const matches = findMatchingRoutes(policiesWithAll, []);
    expect(matches).toHaveLength(1);
    expect(matches[0].route).toHaveProperty('receiver', 'ALL');
  });

  it('should match multiple routes with continue', () => {
    const policiesWithAll: Route = {
      ...policies,
      routes: [
        {
          ...CATCH_ALL_ROUTE,
          continue: true,
        },
        ...(policies.routes ?? []),
      ],
    };

    const matches = findMatchingRoutes(policiesWithAll, [['foo', 'bar']]);
    expect(matches).toHaveLength(2);
    expect(matches[0].route).toHaveProperty('receiver', 'ALL');
    expect(matches[1].route).toHaveProperty('receiver', 'C');
  });

  it('should not match grandchild routes with same labels as parent', () => {
    const policies: Route = {
      receiver: 'PARENT',
      group_by: ['grafana_folder'],
      object_matchers: [['foo', MatcherOperator.equal, 'bar']],
      routes: [
        {
          receiver: 'CHILD',
          object_matchers: [['baz', MatcherOperator.equal, 'qux']],
          routes: [
            {
              receiver: 'GRANDCHILD',
              object_matchers: [['foo', MatcherOperator.equal, 'bar']],
            },
          ],
        },
      ],
      group_wait: '10s',
      group_interval: '1m',
    };

    const matches = findMatchingRoutes(policies, [['foo', 'bar']]);
    expect(matches).toHaveLength(1);
    expect(matches[0].route).toHaveProperty('receiver', 'PARENT');
  });
});

describe('getInheritedProperties()', () => {
  describe('group_by: []', () => {
    it('should get group_by: [] from parent', () => {
      const parent: Route = {
        receiver: 'PARENT',
        group_by: ['label'],
      };

      const child: Route = {
        receiver: 'CHILD',
        group_by: [],
      };

      const childInherited = getInheritedProperties(parent, child);
      expect(childInherited).toHaveProperty('group_by', ['label']);
    });

    it('should get group_by: [] from parent inherited properties', () => {
      const parent: Route = {
        receiver: 'PARENT',
        group_by: [],
      };

      const child: Route = {
        receiver: 'CHILD',
        group_by: [],
      };

      const parentInherited = { group_by: ['label'] };

      const childInherited = getInheritedProperties(parent, child, parentInherited);
      expect(childInherited).toHaveProperty('group_by', ['label']);
    });

    it('should not inherit if the child overrides an inheritable value (group_by)', () => {
      const parent: Route = {
        receiver: 'PARENT',
        group_by: ['parentLabel'],
      };

      const child: Route = {
        receiver: 'CHILD',
        group_by: ['childLabel'],
      };

      const childInherited = getInheritedProperties(parent, child);
      expect(childInherited).not.toHaveProperty('group_by');
    });

    it('should inherit if group_by is undefined', () => {
      const parent: Route = {
        receiver: 'PARENT',
        group_by: ['label'],
      };

      const child: Route = {
        receiver: 'CHILD',
        group_by: undefined,
      };

      const childInherited = getInheritedProperties(parent, child);
      expect(childInherited).toHaveProperty('group_by', ['label']);
    });
  });

  describe('regular "undefined" values', () => {
    it('should compute inherited properties being undefined', () => {
      const parent: Route = {
        receiver: 'PARENT',
        group_wait: '10s',
      };

      const child: Route = {
        receiver: 'CHILD',
      };

      const childInherited = getInheritedProperties(parent, child);
      expect(childInherited).toHaveProperty('group_wait', '10s');
    });

    it('should compute inherited properties being undefined from parent inherited properties', () => {
      const parent: Route = {
        receiver: 'PARENT',
      };

      const child: Route = {
        receiver: 'CHILD',
      };

      const childInherited = getInheritedProperties(parent, child, { group_wait: '10s' });
      expect(childInherited).toHaveProperty('group_wait', '10s');
    });

    it('should not inherit if the child overrides an inheritable value', () => {
      const parent: Route = {
        receiver: 'PARENT',
        group_wait: '10s',
      };

      const child: Route = {
        receiver: 'CHILD',
        group_wait: '30s',
      };

      const childInherited = getInheritedProperties(parent, child);
      expect(childInherited).not.toHaveProperty('group_wait');
    });

    it('should not inherit if the child overrides an inheritable value and the parent inherits', () => {
      const parent: Route = {
        receiver: 'PARENT',
      };

      const child: Route = {
        receiver: 'CHILD',
        group_wait: '30s',
      };

      const childInherited = getInheritedProperties(parent, child, { group_wait: '60s' });
      expect(childInherited).not.toHaveProperty('group_wait');
    });

    it('should inherit if the child property is an empty string', () => {
      const parent: Route = {
        receiver: 'PARENT',
      };

      const child: Route = {
        receiver: '',
        group_wait: '30s',
      };

      const childInherited = getInheritedProperties(parent, child);
      expect(childInherited).toHaveProperty('receiver', 'PARENT');
    });
  });
});

describe('normalizeRoute', () => {
  it('should map matchers property to object_matchers', function () {
    const route: RouteWithID = {
      id: '1',
      matchers: ['foo=bar', 'foo=~ba.*'],
    };

    const normalized = normalizeRoute(route);

    expect(normalized.object_matchers).toHaveLength(2);
    expect(normalized.object_matchers).toContainEqual(['foo', MatcherOperator.equal, 'bar']);
    expect(normalized.object_matchers).toContainEqual(['foo', MatcherOperator.regex, 'ba.*']);
    expect(normalized).not.toHaveProperty('matchers');
  });

  it('should map match and match_re properties to object_matchers', function () {
    const route: RouteWithID = {
      id: '1',
      match: {
        foo: 'bar',
      },
      match_re: {
        team: 'op.*',
      },
    };

    const normalized = normalizeRoute(route);

    expect(normalized.object_matchers).toHaveLength(2);
    expect(normalized.object_matchers).toContainEqual(['foo', MatcherOperator.equal, 'bar']);
    expect(normalized.object_matchers).toContainEqual(['team', MatcherOperator.regex, 'op.*']);

    expect(normalized).not.toHaveProperty('match');
    expect(normalized).not.toHaveProperty('match_re');
  });
});
