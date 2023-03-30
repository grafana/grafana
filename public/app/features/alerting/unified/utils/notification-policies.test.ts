import { MatcherOperator, Route } from 'app/plugins/datasource/alertmanager/types';

import { findMatchingRoutes } from './notification-policies';

const CATCH_ALL_ROUTE: Route = {
  receiver: 'ALL',
  object_matchers: [],
};

describe('findMatchingRoutes', () => {
  const policies: Route = {
    receiver: 'ROOT',
    group_by: ['grafana_folder'],
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
    expect(matches[0]).toHaveProperty('receiver', 'ROOT');
  });

  it('should match parent route with no matching children', () => {
    const matches = findMatchingRoutes(policies, [['team', 'operations']]);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('receiver', 'A');
  });

  it('should match child route of matching parent', () => {
    const matches = findMatchingRoutes(policies, [
      ['team', 'operations'],
      ['region', 'europe'],
    ]);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('receiver', 'B1');
  });

  it('should match simple policy', () => {
    const matches = findMatchingRoutes(policies, [['foo', 'bar']]);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('receiver', 'C');
  });

  it('should match catch-all route', () => {
    const policiesWithAll = {
      ...policies,
      routes: [CATCH_ALL_ROUTE, ...(policies.routes ?? [])],
    };

    const matches = findMatchingRoutes(policiesWithAll, []);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveProperty('receiver', 'ALL');
  });

  it('should match multiple routes with continue', () => {
    const policiesWithAll = {
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
    expect(matches[0]).toHaveProperty('receiver', 'ALL');
    expect(matches[1]).toHaveProperty('receiver', 'C');
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
    expect(matches[0]).toHaveProperty('receiver', 'PARENT');
  });
});
