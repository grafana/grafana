/**
 * These tests were moved from Grafana core, we're keepign them around to prevent uncaught regressions
 */
import { LabelMatcherFactory, RouteFactory } from '../api/notifications/v0alpha1/mocks/fakes/Routes';

import { Route } from './types';
import { findMatchingRoutes } from './utils';

const CATCH_ALL_ROUTE: Route = RouteFactory.build({
  receiver: 'ALL',
  matchers: [],
});

describe('findMatchingRoutes', () => {
  const policies: Route = RouteFactory.build({
    receiver: 'ROOT',
    group_by: ['grafana_folder'],
    matchers: [],
    routes: [
      RouteFactory.build({
        receiver: 'A',
        matchers: [
          LabelMatcherFactory.build({
            label: 'team',
            type: '=',
            value: 'operations',
          }),
        ],
        routes: [
          RouteFactory.build({
            receiver: 'B1',
            matchers: [
              LabelMatcherFactory.build({
                label: 'region',
                type: '=',
                value: 'europe',
              }),
            ],
            routes: [],
          }),
          RouteFactory.build({
            receiver: 'B2',
            matchers: [
              LabelMatcherFactory.build({
                label: 'region',
                type: '=',
                value: 'nasa',
              }),
            ],
            routes: [],
          }),
        ],
      }),
      RouteFactory.build({
        receiver: 'C',
        matchers: [
          LabelMatcherFactory.build({
            label: 'foo',
            type: '=',
            value: 'bar',
          }),
        ],
        routes: [],
      }),
    ],
    group_wait: '10s',
    group_interval: '1m',
  });

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
    const policiesWithNegative = RouteFactory.build({
      ...policies,
      routes: policies.routes?.concat(
        RouteFactory.build({
          receiver: 'D',
          matchers: [
            LabelMatcherFactory.build({
              label: 'name',
              type: '!=',
              value: 'gilles',
            }),
          ],
          routes: [],
        })
      ),
    });
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
    const policiesWithAll: Route = RouteFactory.build({
      ...policies,
      routes: [CATCH_ALL_ROUTE, ...(policies.routes ?? [])],
    });

    const matches = findMatchingRoutes(policiesWithAll, []);
    expect(matches).toHaveLength(1);
    expect(matches[0].route).toHaveProperty('receiver', 'ALL');
  });

  it('should match multiple routes with continue', () => {
    const policiesWithAll: Route = RouteFactory.build({
      ...policies,
      routes: [
        RouteFactory.build({
          ...CATCH_ALL_ROUTE,
          continue: true,
        }),
        ...(policies.routes ?? []),
      ],
    });

    const matches = findMatchingRoutes(policiesWithAll, [['foo', 'bar']]);
    expect(matches).toHaveLength(2);
    expect(matches[0].route).toHaveProperty('receiver', 'ALL');
    expect(matches[1].route).toHaveProperty('receiver', 'C');
  });

  it('should not match grandchild routes with same labels as parent', () => {
    const policies: Route = RouteFactory.build({
      receiver: 'PARENT',
      group_by: ['grafana_folder'],
      matchers: [
        LabelMatcherFactory.build({
          label: 'foo',
          type: '=',
          value: 'bar',
        }),
      ],
      routes: [
        RouteFactory.build({
          receiver: 'CHILD',
          matchers: [
            LabelMatcherFactory.build({
              label: 'baz',
              type: '=',
              value: 'qux',
            }),
          ],
          routes: [
            RouteFactory.build({
              receiver: 'GRANDCHILD',
              matchers: [
                LabelMatcherFactory.build({
                  label: 'foo',
                  type: '=',
                  value: 'bar',
                }),
              ],
              routes: [],
            }),
          ],
        }),
      ],
      group_wait: '10s',
      group_interval: '1m',
    });

    const matches = findMatchingRoutes(policies, [['foo', 'bar']]);
    expect(matches).toHaveLength(1);
    expect(matches[0].route).toHaveProperty('receiver', 'PARENT');
  });
});
