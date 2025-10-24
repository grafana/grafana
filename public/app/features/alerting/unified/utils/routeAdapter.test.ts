import { Factory } from 'fishery';

import { RouteFactory } from '@grafana/alerting/testing';
import { RouteWithID as AlertingRouteWithID } from '@grafana/alerting/unstable';
import { MatcherOperator, ObjectMatcher, Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { routeAdapter } from './routeAdapter';

describe('routeAdapter', () => {
  // Create RouteWithID factory that extends the base RouteFactory
  const RouteWithIDFactory = Factory.define<AlertingRouteWithID>(({ sequence }) => ({
    ...RouteFactory.build(),
    id: `route-${sequence}`,
    routes: [],
  }));

  const mockObjectMatchers: ObjectMatcher[] = [['severity', MatcherOperator.equal, 'critical']];
  const mockLabelMatchers = [
    {
      label: 'severity',
      type: '=' as const,
      value: 'critical',
    },
  ];

  describe('toPackage', () => {
    it('should convert basic Route to AlertingRoute', () => {
      const route: Route = {
        receiver: 'test-receiver',
        continue: true,
        group_by: ['alertname'],
        object_matchers: mockObjectMatchers,
        routes: [],
      };

      const result = routeAdapter.toPackage(route);

      expect(result).toEqual({
        receiver: 'test-receiver',
        continue: true,
        group_by: ['alertname'],
        matchers: mockLabelMatchers,
        routes: [],
        group_wait: undefined,
        group_interval: undefined,
        repeat_interval: undefined,
        mute_time_intervals: undefined,
        active_time_intervals: undefined,
      });
    });

    it('should convert RouteWithID to AlertingRouteWithID', () => {
      const routeWithId: RouteWithID = {
        id: 'test-id',
        receiver: 'test-receiver',
        continue: false,
        object_matchers: mockObjectMatchers,
        routes: [],
      };

      const result = routeAdapter.toPackage(routeWithId);

      expect(result).toEqual({
        id: 'test-id',
        receiver: 'test-receiver',
        continue: false,
        matchers: mockLabelMatchers,
        routes: [],
        group_by: undefined,
        group_wait: undefined,
        group_interval: undefined,
        repeat_interval: undefined,
        mute_time_intervals: undefined,
        active_time_intervals: undefined,
      });
    });

    it('should handle undefined continue as false', () => {
      const route: Route = {
        receiver: 'test-receiver',
        object_matchers: mockObjectMatchers,
        routes: [],
      };

      const result = routeAdapter.toPackage(route);

      expect(result.continue).toBe(false);
    });

    it('should handle null receiver as undefined', () => {
      const route: Route = {
        receiver: null,
        object_matchers: mockObjectMatchers,
        routes: [],
      };

      const result = routeAdapter.toPackage(route);

      expect(result.receiver).toBeUndefined();
    });

    it('should recursively convert child routes', () => {
      const route: RouteWithID = {
        id: 'parent',
        receiver: 'parent-receiver',
        routes: [
          {
            id: 'child',
            receiver: 'child-receiver',
            object_matchers: mockObjectMatchers,
            routes: [],
          },
        ],
      };

      const result = routeAdapter.toPackage(route);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0]).toEqual({
        id: 'child',
        receiver: 'child-receiver',
        continue: false,
        matchers: mockLabelMatchers,
        routes: [],
        group_by: undefined,
        group_wait: undefined,
        group_interval: undefined,
        repeat_interval: undefined,
        mute_time_intervals: undefined,
        active_time_intervals: undefined,
      });
    });
  });

  describe('fromPackage', () => {
    it('should convert basic AlertingRoute to Route', () => {
      const alertingRoute = RouteFactory.build({
        receiver: 'test-receiver',
        continue: true,
        group_by: ['alertname'],
        matchers: mockLabelMatchers,
        routes: [],
      });

      const result = routeAdapter.fromPackage(alertingRoute);

      expect(result.receiver).toBe('test-receiver');
      expect(result.continue).toBe(true);
      expect(result.group_by).toEqual(['alertname']);
      expect(result.object_matchers).toEqual(mockObjectMatchers);
      expect(result.routes).toBeUndefined();
    });

    it('should convert AlertingRouteWithID to RouteWithID', () => {
      const alertingRouteWithId = RouteWithIDFactory.build({
        id: 'test-id',
        receiver: 'test-receiver',
        continue: false,
        matchers: mockLabelMatchers,
        routes: [],
      });

      const result = routeAdapter.fromPackage(alertingRouteWithId);

      expect(result.id).toBe('test-id');
      expect(result.receiver).toBe('test-receiver');
      expect(result.continue).toBe(false);
      expect(result.object_matchers).toEqual(mockObjectMatchers);
      expect(result.routes).toBeUndefined();
    });

    it('should handle undefined receiver as null', () => {
      const alertingRoute = RouteFactory.build();
      // Override receiver to undefined after building
      const alertingRouteWithUndefinedReceiver = {
        ...alertingRoute,
        receiver: undefined,
      };

      const result = routeAdapter.fromPackage(alertingRouteWithUndefinedReceiver);

      expect(result.receiver).toBeNull();
    });

    it('should recursively convert child routes', () => {
      const childRoute = RouteWithIDFactory.build({
        id: 'child',
        receiver: 'child-receiver',
        continue: true,
        matchers: mockLabelMatchers,
        routes: [],
      });

      const alertingRoute = RouteWithIDFactory.build({
        id: 'parent',
        receiver: 'parent-receiver',
        continue: false,
        routes: [childRoute],
      });

      const result = routeAdapter.fromPackage(alertingRoute);

      expect(result.routes).toHaveLength(1);
      expect(result.routes![0].id).toBe('child');
      expect(result.routes![0].receiver).toBe('child-receiver');
      expect(result.routes![0].continue).toBe(true);
      expect(result.routes![0].object_matchers).toEqual(mockObjectMatchers);
      expect(result.routes![0].routes).toBeUndefined();
    });

    it('should handle routes without matchers', () => {
      const alertingRoute = RouteFactory.build();
      // Override matchers to undefined after building
      const alertingRouteWithoutMatchers = {
        ...alertingRoute,
        matchers: undefined,
      };

      const result = routeAdapter.fromPackage(alertingRouteWithoutMatchers);

      expect(result.object_matchers).toBeUndefined();
    });
  });

  describe('round-trip conversion', () => {
    it('should maintain data integrity through round-trip conversion', () => {
      const childRoute: RouteWithID = {
        id: 'child-route',
        receiver: 'child-receiver',
        continue: false,
        object_matchers: [['environment', MatcherOperator.equal, 'prod']],
        routes: [],
      };

      const originalRoute: RouteWithID = {
        id: 'test-route',
        receiver: 'test-receiver',
        continue: true,
        group_by: ['alertname', 'severity'],
        group_wait: '10s',
        group_interval: '5m',
        repeat_interval: '1h',
        object_matchers: [
          ['severity', MatcherOperator.equal, 'critical'],
          ['team', MatcherOperator.regex, 'frontend|backend'],
        ],
        mute_time_intervals: ['maintenance'],
        active_time_intervals: ['business-hours'],
        routes: [childRoute],
      };

      // Convert to package format and back
      const packageRoute = routeAdapter.toPackage(originalRoute);
      const backToOriginal = routeAdapter.fromPackage(packageRoute);

      expect(backToOriginal).toEqual({
        ...originalRoute,
        routes: [
          {
            ...childRoute,
            routes: undefined, // fromPackage doesn't add routes array if empty
          },
        ],
      });
    });
  });
});
