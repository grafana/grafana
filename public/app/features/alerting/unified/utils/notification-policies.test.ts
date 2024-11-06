import { MatcherOperator, Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import {
  InheritableProperties,
  computeInheritedTree,
  findMatchingRoutes,
  getInheritedProperties,
  matchLabels,
  normalizeRoute,
  unquoteRouteMatchers,
} from './notification-policies';

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
        object_matchers: [['team', MatcherOperator.equal, 'operations']],
        routes: [
          {
            receiver: 'B1',
            object_matchers: [['region', MatcherOperator.equal, 'europe']],
          },
          {
            receiver: 'B2',
            object_matchers: [['region', MatcherOperator.equal, 'nasa']],
          },
        ],
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

  it('should match route with negative matchers', () => {
    const policiesWithNegative = {
      ...policies,
      routes: policies.routes?.concat({
        receiver: 'D',
        object_matchers: [['name', MatcherOperator.notEqual, 'gilles']],
      }),
    };
    const matches = findMatchingRoutes(policiesWithNegative, [['name', 'konrad']]);
    expect(matches).toHaveLength(1);
    expect(matches[0].route).toHaveProperty('receiver', 'D');
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

    it('should inherit from grandparent when parent is inheriting', () => {
      const parentInheritedProperties: InheritableProperties = { receiver: 'grandparent' };
      const parent: Route = { receiver: null, group_by: ['foo'] };
      const child: Route = { receiver: null };

      const childInherited = getInheritedProperties(parent, child, parentInheritedProperties);
      expect(childInherited).toHaveProperty('receiver', 'grandparent');
      expect(childInherited.group_by).toEqual(['foo']);
    });
  });

  describe('regular "undefined" or "null" values', () => {
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

    it('should compute inherited properties being null', () => {
      const parent: Route = {
        receiver: 'PARENT',
        group_wait: '10s',
      };

      const child: Route = {
        receiver: null,
      };

      const childInherited = getInheritedProperties(parent, child);
      expect(childInherited).toHaveProperty('receiver', 'PARENT');
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

  describe('timing options', () => {
    it('should inherit timing options', () => {
      const parent: Route = {
        receiver: 'PARENT',
        group_wait: '1m',
        group_interval: '2m',
      };

      const child: Route = {
        repeat_interval: '999s',
      };

      const childInherited = getInheritedProperties(parent, child);
      expect(childInherited).toHaveProperty('group_wait', '1m');
      expect(childInherited).toHaveProperty('group_interval', '2m');
    });
  });
  it('should not inherit mute timings from parent route', () => {
    const parent: Route = {
      receiver: 'PARENT',
      group_by: ['parentLabel'],
      mute_time_intervals: ['Mon-Fri 09:00-17:00'],
    };

    const child: Route = {
      receiver: 'CHILD',
      group_by: ['childLabel'],
    };

    const childInherited = getInheritedProperties(parent, child);
    expect(childInherited).not.toHaveProperty('mute_time_intervals');
  });
});

describe('computeInheritedTree', () => {
  it('should merge properties from parent', () => {
    const parent: Route = {
      receiver: 'PARENT',
      group_wait: '1m',
      group_interval: '2m',
      repeat_interval: '3m',
      routes: [
        {
          repeat_interval: '999s',
        },
      ],
    };

    const treeRoot = computeInheritedTree(parent);
    expect(treeRoot).toHaveProperty('group_wait', '1m');
    expect(treeRoot).toHaveProperty('group_interval', '2m');
    expect(treeRoot).toHaveProperty('repeat_interval', '3m');

    expect(treeRoot).toHaveProperty('routes.0.group_wait', '1m');
    expect(treeRoot).toHaveProperty('routes.0.group_interval', '2m');
    expect(treeRoot).toHaveProperty('routes.0.repeat_interval', '999s');
  });

  it('should not regress #73573', () => {
    const parent: Route = {
      routes: [
        {
          group_wait: '1m',
          group_interval: '2m',
          repeat_interval: '3m',
          routes: [
            {
              group_wait: '10m',
              group_interval: '20m',
              repeat_interval: '30m',
            },
            {
              repeat_interval: '999m',
            },
          ],
        },
      ],
    };

    const treeRoot = computeInheritedTree(parent);
    expect(treeRoot).toHaveProperty('routes.0.group_wait', '1m');
    expect(treeRoot).toHaveProperty('routes.0.group_interval', '2m');
    expect(treeRoot).toHaveProperty('routes.0.repeat_interval', '3m');

    expect(treeRoot).toHaveProperty('routes.0.routes.0.group_wait', '10m');
    expect(treeRoot).toHaveProperty('routes.0.routes.0.group_interval', '20m');
    expect(treeRoot).toHaveProperty('routes.0.routes.0.repeat_interval', '30m');

    expect(treeRoot).toHaveProperty('routes.0.routes.1.group_wait', '1m');
    expect(treeRoot).toHaveProperty('routes.0.routes.1.group_interval', '2m');
    expect(treeRoot).toHaveProperty('routes.0.routes.1.repeat_interval', '999m');
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

describe('matchLabels', () => {
  it('should match with non-matching matchers', () => {
    const result = matchLabels(
      [
        ['foo', MatcherOperator.equal, ''],
        ['team', MatcherOperator.equal, 'operations'],
      ],
      [['team', 'operations']]
    );

    expect(result).toHaveProperty('matches', true);
    expect(result.labelsMatch).toMatchSnapshot();
  });

  it('should match with non-equal matchers', () => {
    const result = matchLabels(
      [
        ['foo', MatcherOperator.notEqual, 'bar'],
        ['team', MatcherOperator.equal, 'operations'],
      ],
      [['team', 'operations']]
    );

    expect(result).toHaveProperty('matches', true);
    expect(result.labelsMatch).toMatchSnapshot();
  });

  it('should not match with a set of matchers', () => {
    const result = matchLabels(
      [
        ['foo', MatcherOperator.notEqual, 'bar'],
        ['team', MatcherOperator.equal, 'operations'],
      ],
      [
        ['team', 'operations'],
        ['foo', 'bar'],
      ]
    );

    expect(result).toHaveProperty('matches', false);
    expect(result.labelsMatch).toMatchSnapshot();
  });

  it('does not match unanchored regular expressions', () => {
    const result = matchLabels([['foo', MatcherOperator.regex, 'bar']], [['foo', 'barbarbar']]);
    // This may seem unintuitive, but this is how Alertmanager matches, as it anchors the regex
    expect(result.matches).toEqual(false);
  });

  it('matches regular expressions with wildcards', () => {
    const result = matchLabels([['foo', MatcherOperator.regex, '.*bar.*']], [['foo', 'barbarbar']]);
    expect(result.matches).toEqual(true);
  });

  it('does match regular expressions with flags', () => {
    const result = matchLabels([['foo', MatcherOperator.regex, '(?i).*BAr.*']], [['foo', 'barbarbar']]);
    expect(result.matches).toEqual(true);
  });
});

describe('unquoteRouteMatchers', () => {
  it('should unquote and unescape matchers values', () => {
    const route: RouteWithID = {
      id: '1',
      object_matchers: [
        ['foo', MatcherOperator.equal, 'bar'],
        ['foo', MatcherOperator.equal, '"bar"'],
        ['foo', MatcherOperator.equal, '"b\\\\ar b\\"az"'],
      ],
    };

    const unwrapped = unquoteRouteMatchers(route);

    expect(unwrapped.object_matchers).toHaveLength(3);
    expect(unwrapped.object_matchers).toContainEqual(['foo', MatcherOperator.equal, 'bar']);
    expect(unwrapped.object_matchers).toContainEqual(['foo', MatcherOperator.equal, 'bar']);
    expect(unwrapped.object_matchers).toContainEqual(['foo', MatcherOperator.equal, 'b\\ar b"az']);
  });

  it('should unquote and unescape matcher names', () => {
    const route: RouteWithID = {
      id: '1',
      object_matchers: [
        ['"f\\"oo with quote"', MatcherOperator.equal, 'bar'],
        ['"f\\\\oo with slash"', MatcherOperator.equal, 'bar'],
      ],
    };

    const unwrapped = unquoteRouteMatchers(route);

    expect(unwrapped.object_matchers).toHaveLength(2);
    expect(unwrapped.object_matchers).toContainEqual(['f"oo with quote', MatcherOperator.equal, 'bar']);
    expect(unwrapped.object_matchers).toContainEqual(['f\\oo with slash', MatcherOperator.equal, 'bar']);
  });
});
