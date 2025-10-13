import {
  AlertState,
  AlertmanagerAlert,
  AlertmanagerGroup,
  MatcherOperator,
  ObjectMatcher,
  RouteWithID,
} from 'app/plugins/datasource/alertmanager/types';

import { findMatchingAlertGroups, normalizeRoute, unquoteRouteMatchers } from './notification-policies';

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

describe('findMatchingAlertGroups', () => {
  // Helper functions to create minimal test data
  const createAlert = (labels: Record<string, string>): AlertmanagerAlert => ({
    labels,
    annotations: {},
    startsAt: '2024-01-01T00:00:00Z',
    endsAt: '2024-01-01T01:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    fingerprint: 'test-fingerprint',
    receivers: [{ name: 'default' }],
    status: {
      state: AlertState.Active,
      silencedBy: [],
      inhibitedBy: [],
    },
  });

  const createGroup = (alerts: AlertmanagerAlert[]): AlertmanagerGroup => ({
    labels: {},
    receiver: { name: 'default' },
    alerts,
  });

  const createRoute = (
    id: string,
    matchers?: ObjectMatcher[],
    routes?: RouteWithID[],
    continueMatching?: boolean
  ): RouteWithID => ({
    id,
    receiver: 'default',
    object_matchers: matchers,
    routes,
    continue: continueMatching,
  });

  it('should match alerts to the correct route by ID', () => {
    // Create a route tree with 2 child routes
    const teamFrontendRoute = createRoute('route-1', [['team', MatcherOperator.equal, 'frontend']]);
    const teamBackendRoute = createRoute('route-2', [['team', MatcherOperator.equal, 'backend']]);
    const rootRoute = createRoute('root', [], [teamFrontendRoute, teamBackendRoute]);

    const frontendCriticalAlert = createAlert({ team: 'frontend', severity: 'critical' });
    const backendWarningAlert = createAlert({ team: 'backend', severity: 'warning' });

    const alertGroups: AlertmanagerGroup[] = [createGroup([frontendCriticalAlert, backendWarningAlert])];

    // Test matching alerts for teamFrontendRoute
    const result = findMatchingAlertGroups(rootRoute, teamFrontendRoute, alertGroups);

    expect(result).toHaveLength(1);
    expect(result[0].alerts).toHaveLength(1);
    expect(result[0].alerts).toContainEqual(frontendCriticalAlert);
  });

  it('should return empty array when no alerts match the route', () => {
    const teamFrontendRoute = createRoute('route-1', [['team', MatcherOperator.equal, 'frontend']]);
    const rootRoute = createRoute('root', [], [teamFrontendRoute]);

    const backendAlert = createAlert({ team: 'backend' });
    const opsAlert = createAlert({ team: 'ops' });

    const alertGroups: AlertmanagerGroup[] = [createGroup([backendAlert, opsAlert])];

    const result = findMatchingAlertGroups(rootRoute, teamFrontendRoute, alertGroups);

    expect(result).toHaveLength(0);
  });

  it('should handle alerts matching the root route', () => {
    // Root route with no matchers (catch-all)
    const rootRoute = createRoute('root', []);

    const frontendAlert = createAlert({ team: 'frontend' });
    const backendAlert = createAlert({ team: 'backend' });

    const alertGroups: AlertmanagerGroup[] = [createGroup([frontendAlert, backendAlert])];

    const result = findMatchingAlertGroups(rootRoute, rootRoute, alertGroups);

    expect(result).toHaveLength(1);
    expect(result[0].alerts).toHaveLength(2);
    expect(result[0].alerts).toContainEqual(frontendAlert);
    expect(result[0].alerts).toContainEqual(backendAlert);
  });

  it('should correctly filter alerts within groups', () => {
    const severityCritialRoute = createRoute('route-1', [['severity', MatcherOperator.equal, 'critical']]);
    const rootRoute = createRoute('root', [], [severityCritialRoute]);

    const criticalFrontendAlert = createAlert({ severity: 'critical', team: 'frontend' });
    const warningFrontendAlert = createAlert({ severity: 'warning', team: 'frontend' });
    const criticalBackendAlert = createAlert({ severity: 'critical', team: 'backend' });

    const alertGroups: AlertmanagerGroup[] = [
      createGroup([criticalFrontendAlert, warningFrontendAlert, criticalBackendAlert]),
    ];

    const result = findMatchingAlertGroups(rootRoute, severityCritialRoute, alertGroups);

    expect(result).toHaveLength(1);
    expect(result[0].alerts).toHaveLength(2);

    // Verify only critical alerts are returned
    expect(result[0].alerts).toContainEqual(criticalFrontendAlert);
    expect(result[0].alerts).toContainEqual(criticalBackendAlert);
    expect(result[0].alerts).not.toContainEqual(warningFrontendAlert);
  });

  it('should handle multiple alert groups', () => {
    const teamFrontendRoute = createRoute('route-1', [['team', MatcherOperator.equal, 'frontend']]);
    const rootRoute = createRoute('root', [], [teamFrontendRoute]);

    const frontendProdAlert = createAlert({ team: 'frontend', env: 'prod' });
    const backendProdAlert = createAlert({ team: 'backend', env: 'prod' });
    const frontendDevAlert = createAlert({ team: 'frontend', env: 'dev' });

    const alertGroups: AlertmanagerGroup[] = [
      createGroup([frontendProdAlert]),
      createGroup([backendProdAlert]),
      createGroup([frontendDevAlert]),
    ];

    const result = findMatchingAlertGroups(rootRoute, teamFrontendRoute, alertGroups);

    expect(result).toHaveLength(2);

    // Verify we got the correct alerts (frontend only)
    const allAlerts = result.flatMap((group) => group.alerts);
    expect(allAlerts).toHaveLength(2);
    expect(allAlerts).toContainEqual(frontendProdAlert);
    expect(allAlerts).toContainEqual(frontendDevAlert);
    expect(allAlerts).not.toContainEqual(backendProdAlert);
  });

  it('should match alerts using regex matchers', () => {
    const route: RouteWithID = createRoute('route-1', [['service', MatcherOperator.regex, 'api-.*']]);
    const rootRoute: RouteWithID = createRoute('root', [], [route]);

    const apiFrontendAlert = createAlert({ service: 'api-frontend' });
    const apiBackendAlert = createAlert({ service: 'api-backend' });
    const workerAlert = createAlert({ service: 'worker' });

    const alertGroups: AlertmanagerGroup[] = [createGroup([apiFrontendAlert, apiBackendAlert, workerAlert])];

    const result = findMatchingAlertGroups(rootRoute, route, alertGroups);

    expect(result).toHaveLength(1);
    expect(result[0].alerts).toHaveLength(2);

    // Verify we got the api-* alerts and not the worker alert
    expect(result[0].alerts).toContainEqual(apiFrontendAlert);
    expect(result[0].alerts).toContainEqual(apiBackendAlert);
    expect(result[0].alerts).not.toContainEqual(workerAlert);
  });

  it('should match alerts with multiple matchers (AND logic)', () => {
    const route: RouteWithID = createRoute('route-1', [
      ['team', MatcherOperator.equal, 'frontend'],
      ['severity', MatcherOperator.equal, 'critical'],
    ]);
    const rootRoute: RouteWithID = createRoute('root', [], [route]);

    const frontendCriticalAlert = createAlert({ team: 'frontend', severity: 'critical' });
    const frontendWarningAlert = createAlert({ team: 'frontend', severity: 'warning' });
    const backendCriticalAlert = createAlert({ team: 'backend', severity: 'critical' });

    const alertGroups: AlertmanagerGroup[] = [
      createGroup([frontendCriticalAlert, frontendWarningAlert, backendCriticalAlert]),
    ];

    const result = findMatchingAlertGroups(rootRoute, route, alertGroups);

    expect(result).toHaveLength(1);
    expect(result[0].alerts).toHaveLength(1);

    // Only the alert matching both conditions should be returned
    expect(result[0].alerts).toContainEqual(frontendCriticalAlert);
    expect(result[0].alerts).not.toContainEqual(frontendWarningAlert);
    expect(result[0].alerts).not.toContainEqual(backendCriticalAlert);
  });

  it('should match only the first route when multiple routes have identical matchers', () => {
    // Create two routes with identical matchers - only the first should match (depth-first left-to-right)
    const firstTeamFrontendRoute: RouteWithID = createRoute('route-1', [['team', MatcherOperator.equal, 'frontend']]);
    const secondTeamFrontendRoute: RouteWithID = createRoute('route-2', [['team', MatcherOperator.equal, 'frontend']]);
    const rootRoute: RouteWithID = createRoute('root', [], [firstTeamFrontendRoute, secondTeamFrontendRoute]);

    const frontendCriticalAlert = createAlert({ team: 'frontend', severity: 'critical' });
    const alertGroups: AlertmanagerGroup[] = [createGroup([frontendCriticalAlert])];

    // Check that firstTeamFrontendRoute matches
    const resultFirst = findMatchingAlertGroups(rootRoute, firstTeamFrontendRoute, alertGroups);
    expect(resultFirst).toHaveLength(1);
    expect(resultFirst[0].alerts).toContainEqual(frontendCriticalAlert);

    // Check that secondTeamFrontendRoute does NOT match (alert stops at first route)
    const resultSecond = findMatchingAlertGroups(rootRoute, secondTeamFrontendRoute, alertGroups);
    expect(resultSecond).toHaveLength(0);
  });

  it('should match multiple routes when continue flag is set to true', () => {
    // Create routes with continue=true on the first one
    const teamFrontendRouteWithContinue: RouteWithID = createRoute(
      'route-1',
      [['team', MatcherOperator.equal, 'frontend']],
      [],
      true // continue=true
    );
    const teamFrontendSiblingRoute: RouteWithID = createRoute('route-2', [['team', MatcherOperator.equal, 'frontend']]);
    const rootRoute: RouteWithID = createRoute('root', [], [teamFrontendRouteWithContinue, teamFrontendSiblingRoute]);

    const frontendCriticalAlert = createAlert({ team: 'frontend', severity: 'critical' });
    const alertGroups: AlertmanagerGroup[] = [createGroup([frontendCriticalAlert])];

    // With continue=true, both routes should match the same alert
    const resultWithContinue = findMatchingAlertGroups(rootRoute, teamFrontendRouteWithContinue, alertGroups);
    expect(resultWithContinue).toHaveLength(1);
    expect(resultWithContinue[0].alerts).toContainEqual(frontendCriticalAlert);

    const resultSibling = findMatchingAlertGroups(rootRoute, teamFrontendSiblingRoute, alertGroups);
    expect(resultSibling).toHaveLength(1);
    expect(resultSibling[0].alerts).toContainEqual(frontendCriticalAlert);
  });

  it('should handle nested routes with continue flag', () => {
    // Create a more complex tree:
    // root
    //   ├─ teamFrontendRouteWithContinue (team=frontend, continue=true)
    //   │   └─ severityCriticalSubRoute (severity=critical)
    //   └─ teamFrontendSiblingRoute (team=frontend)
    const severityCriticalSubRoute: RouteWithID = createRoute('severity-critical-sub', [
      ['severity', MatcherOperator.equal, 'critical'],
    ]);
    const teamFrontendRouteWithContinue: RouteWithID = createRoute(
      'team-frontend-continue',
      [['team', MatcherOperator.equal, 'frontend']],
      [severityCriticalSubRoute],
      true
    );
    const teamFrontendSiblingRoute: RouteWithID = createRoute('team-frontend-sibling', [
      ['team', MatcherOperator.equal, 'frontend'],
    ]);
    const rootRoute: RouteWithID = createRoute('root', [], [teamFrontendRouteWithContinue, teamFrontendSiblingRoute]);

    const frontendCriticalAlert = createAlert({ team: 'frontend', severity: 'critical' });
    const frontendWarningAlert = createAlert({ team: 'frontend', severity: 'warning' });

    const alertGroups: AlertmanagerGroup[] = [createGroup([frontendCriticalAlert, frontendWarningAlert])];

    // severityCriticalSubRoute should match only the critical alert (most specific match)
    const resultSubRoute = findMatchingAlertGroups(rootRoute, severityCriticalSubRoute, alertGroups);
    expect(resultSubRoute).toHaveLength(1);
    expect(resultSubRoute[0].alerts).toHaveLength(1);
    expect(resultSubRoute[0].alerts).toContainEqual(frontendCriticalAlert);

    // teamFrontendSiblingRoute should match both alerts because teamFrontendRouteWithContinue has continue=true
    const resultSibling = findMatchingAlertGroups(rootRoute, teamFrontendSiblingRoute, alertGroups);
    expect(resultSibling).toHaveLength(1);
    expect(resultSibling[0].alerts).toHaveLength(2);
    expect(resultSibling[0].alerts).toContainEqual(frontendCriticalAlert);
    expect(resultSibling[0].alerts).toContainEqual(frontendWarningAlert);
  });

  it('should stop at first match when continue flag is false (default)', () => {
    // Test that without continue flag, matching stops at first route
    const firstSeverityCriticalRoute: RouteWithID = createRoute(
      'first-severity-critical',
      [['severity', MatcherOperator.equal, 'critical']],
      [],
      false
    );
    const secondSeverityCriticalRoute: RouteWithID = createRoute('second-severity-critical', [
      ['severity', MatcherOperator.equal, 'critical'],
    ]);
    const teamFrontendRoute: RouteWithID = createRoute('team-frontend', [['team', MatcherOperator.equal, 'frontend']]);
    const rootRoute: RouteWithID = createRoute(
      'root',
      [],
      [firstSeverityCriticalRoute, secondSeverityCriticalRoute, teamFrontendRoute]
    );

    const frontendCriticalAlert = createAlert({ team: 'frontend', severity: 'critical' });
    const alertGroups: AlertmanagerGroup[] = [createGroup([frontendCriticalAlert])];

    // firstSeverityCriticalRoute should match (first matching route)
    const resultFirst = findMatchingAlertGroups(rootRoute, firstSeverityCriticalRoute, alertGroups);
    expect(resultFirst).toHaveLength(1);
    expect(resultFirst[0].alerts).toContainEqual(frontendCriticalAlert);

    // secondSeverityCriticalRoute should NOT match (stopped at first route)
    const resultSecond = findMatchingAlertGroups(rootRoute, secondSeverityCriticalRoute, alertGroups);
    expect(resultSecond).toHaveLength(0);

    // teamFrontendRoute should NOT match (stopped at first route)
    const resultTeam = findMatchingAlertGroups(rootRoute, teamFrontendRoute, alertGroups);
    expect(resultTeam).toHaveLength(0);
  });
});
