import { Label, LabelMatcher } from '../matchers/types';
import { LabelMatchDetails } from '../matchers/utils';
import { Route } from './types';
import { findMatchingRoutes, RouteMatchResult } from './utils';

// Helper function to create a basic route
const createRoute = (
  matchers: LabelMatcher[] = [],
  receiver = 'default',
  routes: Route[] = [],
  continueMatching = false
): Route => ({
  receiver,
  matchers,
  routes,
  continue: continueMatching,
  group_by: [],
  group_wait: '10s',
  group_interval: '5m',
  repeat_interval: '12h',
  mute_time_intervals: [],
  active_time_intervals: [],
});

describe('findMatchingRoutes', () => {
  describe('basic matching', () => {
    it('should return empty array when route does not match', () => {
      const route = createRoute([{ label: 'service', type: '=', value: 'web' }]);
      const labels: Label[] = [['service', 'api']];

      const result = findMatchingRoutes(route, labels);

      expect(result).toEqual([]);
    });

    it('should match route with exact label match', () => {
      const route = createRoute([{ label: 'service', type: '=', value: 'web' }], 'web-receiver');
      const labels: Label[] = [['service', 'web']];

      const result = findMatchingRoutes(route, labels);

      expect(result).toHaveLength(1);
      expect(result[0].route).toBe(route);
      expect(result[0].labels).toBe(labels);
      expect(getRoutePath(result[0])).toEqual([route]);
    });

    it('should match route with multiple matchers', () => {
      const route = createRoute([
        { label: 'service', type: '=', value: 'web' },
        { label: 'env', type: '=', value: 'prod' },
      ]);
      const labels: Label[] = [
        ['service', 'web'],
        ['env', 'prod'],
        ['team', 'backend'],
      ];

      const result = findMatchingRoutes(route, labels);

      expect(result).toHaveLength(1);
      expect(result[0].route).toBe(route);
      expect(getRoutePath(result[0])).toEqual([route]);
    });

    it('should not match when one matcher fails', () => {
      const route = createRoute([
        { label: 'service', type: '=', value: 'web' },
        { label: 'env', type: '=', value: 'prod' },
      ]);
      const labels: Label[] = [
        ['service', 'web'],
        ['env', 'staging'],
      ];

      const result = findMatchingRoutes(route, labels);

      expect(result).toEqual([]);
    });

    it('should match route with no matchers (catch-all)', () => {
      const route = createRoute([], 'default-receiver');
      const labels: Label[] = [['service', 'web']];

      const result = findMatchingRoutes(route, labels);

      expect(result).toHaveLength(1);
      expect(result[0].route).toBe(route);
      expect(getRoutePath(result[0])).toEqual([route]);
    });
  });

  describe('nested route matching', () => {
    it('should return child route when child matches', () => {
      const childRoute = createRoute([{ label: 'env', type: '=', value: 'prod' }], 'prod-receiver');
      const parentRoute = createRoute([{ label: 'service', type: '=', value: 'web' }], 'web-receiver', [
        childRoute,
      ]);
      const labels: Label[] = [
        ['service', 'web'],
        ['env', 'prod'],
      ];

      const result = findMatchingRoutes(parentRoute, labels);

      expect(result).toHaveLength(1);
      expect(result[0].route).toBe(childRoute);
      expect(getRoutePath(result[0])).toEqual([parentRoute, childRoute]);
    });

    it('should return parent route when parent matches but child does not', () => {
      const childRoute = createRoute([{ label: 'env', type: '=', value: 'staging' }], 'staging-receiver');
      const parentRoute = createRoute([{ label: 'service', type: '=', value: 'web' }], 'web-receiver', [
        childRoute,
      ]);
      const labels: Label[] = [
        ['service', 'web'],
        ['env', 'prod'],
      ];

      const result = findMatchingRoutes(parentRoute, labels);

      expect(result).toHaveLength(1);
      expect(result[0].route).toBe(parentRoute);
      expect(getRoutePath(result[0])).toEqual([parentRoute]);
    });

    it('should return empty array when parent does not match', () => {
      const childRoute = createRoute([{ label: 'env', type: '=', value: 'prod' }], 'prod-receiver');
      const parentRoute = createRoute([{ label: 'service', type: '=', value: 'api' }], 'api-receiver', [
        childRoute,
      ]);
      const labels: Label[] = [
        ['service', 'web'],
        ['env', 'prod'],
      ];

      const result = findMatchingRoutes(parentRoute, labels);

      expect(result).toEqual([]);
    });

    it('should handle deeply nested routes', () => {
      const grandChildRoute = createRoute([{ label: 'region', type: '=', value: 'us-east' }], 'us-east-receiver');
      const grandChildRoute2 = createRoute([{ label: 'region', type: '=', value: 'ew-west' }], 'us-west-receiver');
      
      const childRoute = createRoute([{ label: 'env', type: '=', value: 'prod' }], 'prod-receiver', [
        grandChildRoute, grandChildRoute2
      ]);
      const parentRoute = createRoute([{ label: 'service', type: '=', value: 'web' }], 'web-receiver', [
        childRoute,
      ]);
      const labels: Label[] = [
        ['service', 'web'],
        ['env', 'prod'],
        ['region', 'us-east'],
      ];

      const result = findMatchingRoutes(parentRoute, labels);

      expect(result).toHaveLength(1);
      expect(result[0].route).toBe(grandChildRoute);
      expect(getRoutePath(result[0])).toEqual([parentRoute, childRoute, grandChildRoute]);
    });
  });

  describe('continue behavior', () => {
    it('should return first matching child when continue is false', () => {
      const childRoute1 = createRoute([{ label: 'env', type: '=', value: 'prod' }], 'prod-receiver', [], false);
      const childRoute2 = createRoute([{ label: 'team', type: '=', value: 'backend' }], 'backend-receiver');
      const parentRoute = createRoute([{ label: 'service', type: '=', value: 'web' }], 'web-receiver', [
        childRoute1,
        childRoute2,
      ]);
      const labels: Label[] = [
        ['service', 'web'],
        ['env', 'prod'],
        ['team', 'backend'],
      ];

      const result = findMatchingRoutes(parentRoute, labels);

      expect(result).toHaveLength(1);
      expect(result[0].route).toBe(childRoute1);
      expect(getRoutePath(result[0])).toEqual([parentRoute, childRoute1]);
    });

    it('should return multiple matching children when continue is true', () => {
      const childRoute1 = createRoute([{ label: 'env', type: '=', value: 'prod' }], 'prod-receiver', [], true);
      const childRoute2 = createRoute([{ label: 'team', type: '=', value: 'backend' }], 'backend-receiver');
      const parentRoute = createRoute([{ label: 'service', type: '=', value: 'web' }], 'web-receiver', [
        childRoute1,
        childRoute2,
      ]);
      const labels: Label[] = [
        ['service', 'web'],
        ['env', 'prod'],
        ['team', 'backend'],
      ];

      const result = findMatchingRoutes(parentRoute, labels);

      expect(result).toHaveLength(2);
      expect(result[0].route).toBe(childRoute1);
      expect(getRoutePath(result[0])).toEqual([parentRoute, childRoute1]);
      expect(result[1].route).toBe(childRoute2);
      expect(getRoutePath(result[1])).toEqual([parentRoute, childRoute2]);
    });

    it('should continue processing siblings when continue is true', () => {
      const childRoute1 = createRoute([{ label: 'env', type: '=', value: 'prod' }], 'prod-receiver', [], true);
      const childRoute2 = createRoute([{ label: 'team', type: '=', value: 'frontend' }], 'frontend-receiver');
      const childRoute3 = createRoute([{ label: 'priority', type: '=', value: 'high' }], 'high-receiver');
      const parentRoute = createRoute([{ label: 'service', type: '=', value: 'web' }], 'web-receiver', [
        childRoute1,
        childRoute2,
        childRoute3,
      ]);
      const labels: Label[] = [
        ['service', 'web'],
        ['env', 'prod'],
        ['team', 'backend'], // doesn't match childRoute2
        ['priority', 'high'],
      ];

      const result = findMatchingRoutes(parentRoute, labels);

      expect(result).toHaveLength(2); // childRoute1 and childRoute3 both match
      expect(result[0].route).toBe(childRoute1);
      expect(getRoutePath(result[0])).toEqual([parentRoute, childRoute1]);
      expect(result[1].route).toBe(childRoute3);
      expect(getRoutePath(result[1])).toEqual([parentRoute, childRoute3]);
    });
  });

  describe('route path tracking', () => {
    it('should track route path with initial path provided', () => {
      const initialRoute = createRoute([{ label: 'app', type: '=', value: 'grafana' }], 'grafana-receiver');
      const route = createRoute([{ label: 'service', type: '=', value: 'web' }], 'web-receiver');
      const labels: Label[] = [['service', 'web']];

      // Create a matching journey with the initial route
      const initialMatchInfo = {
        route: initialRoute,
        matchDetails: [],
        matched: true,
      };
      const result = findMatchingRoutes(route, labels, [initialMatchInfo]);

      expect(result).toHaveLength(1);
      expect(getRoutePath(result[0])).toEqual([initialRoute, route]);
    });

    it('should handle empty initial route path', () => {
      const route = createRoute([{ label: 'service', type: '=', value: 'web' }], 'web-receiver');
      const labels: Label[] = [['service', 'web']];

      const result = findMatchingRoutes(route, labels, []);

      expect(result).toHaveLength(1);
      expect(getRoutePath(result[0])).toEqual([route]);
    });

    it('should preserve route path through multiple levels', () => {
      const level3Route = createRoute([{ label: 'instance', type: '=', value: 'i-123' }], 'instance-receiver');
      const level2Route = createRoute([{ label: 'env', type: '=', value: 'prod' }], 'prod-receiver', [level3Route]);
      const level1Route = createRoute([{ label: 'service', type: '=', value: 'web' }], 'web-receiver', [level2Route]);
      const rootRoute = createRoute([], 'root-receiver', [level1Route]);

      const labels: Label[] = [
        ['service', 'web'],
        ['env', 'prod'],
        ['instance', 'i-123'],
      ];

      const result = findMatchingRoutes(rootRoute, labels);

      expect(result).toHaveLength(1);
      expect(result[0].route).toBe(level3Route);
      expect(getRoutePath(result[0])).toEqual([rootRoute, level1Route, level2Route, level3Route]);
    });
  });

  describe('match details', () => {
    it('should include match details for successful matches', () => {
      const route = createRoute([
        { label: 'service', type: '=', value: 'web' },
        { label: 'env', type: '=', value: 'prod' },
      ]);
      const labels: Label[] = [
        ['service', 'web'],
        ['env', 'prod'],
        ['team', 'backend'],
      ];

      const result = findMatchingRoutes(route, labels);

      expect(result).toHaveLength(1);
      const matchDetails = getMatchDetails(result[0]);
      expect(matchDetails).toBeDefined();
      expect(matchDetails).toHaveLength(3); // One for each label
      expect(matchDetails[0].labelIndex).toBe(0);
      expect(matchDetails[0].match).toBe(true);
      expect(matchDetails[1].labelIndex).toBe(1);
      expect(matchDetails[1].match).toBe(true);
      expect(matchDetails[2].labelIndex).toBe(2);
      expect(matchDetails[2].match).toBe(false); // team label doesn't have a matcher
    });
  });

  describe('regex matchers', () => {
    it('should handle regex positive matching', () => {
      const route = createRoute([{ label: 'service', type: '=~', value: 'web.*' }], 'web-receiver');
      const labels: Label[] = [['service', 'web-api']];

      const result = findMatchingRoutes(route, labels);

      expect(result).toHaveLength(1);
      expect(result[0].route).toBe(route);
    });

    it('should handle regex negative matching', () => {
      const route = createRoute([{ label: 'service', type: '!~', value: 'web.*' }], 'non-web-receiver');
      const labels: Label[] = [['service', 'api-backend']];

      const result = findMatchingRoutes(route, labels);

      expect(result).toHaveLength(1);
      expect(result[0].route).toBe(route);
    });

    it('should not match when regex positive match fails', () => {
      const route = createRoute([{ label: 'service', type: '=~', value: 'web.*' }]);
      const labels: Label[] = [['service', 'api-backend']];

      const result = findMatchingRoutes(route, labels);

      expect(result).toEqual([]);
    });
  });

  describe('matching journey tracking', () => {
    it('should track matching journey for single route', () => {
      const route = createRoute([{ label: 'service', type: '=', value: 'web' }], 'web-receiver');
      const labels: Label[] = [['service', 'web']];

      const result = findMatchingRoutes(route, labels);

      expect(result).toHaveLength(1);
      expect(result[0].matchingJourney).toHaveLength(1);
      expect(result[0].matchingJourney[0].route).toBe(route);
      expect(result[0].matchingJourney[0].matched).toBe(true);
      expect(result[0].matchingJourney[0].matchDetails).toBeDefined();
    });

    it('should track matching journey through nested routes', () => {
      const childRoute = createRoute([{ label: 'env', type: '=', value: 'prod' }], 'prod-receiver');
      const parentRoute = createRoute([{ label: 'service', type: '=', value: 'web' }], 'web-receiver', [childRoute]);
      const labels: Label[] = [
        ['service', 'web'],
        ['env', 'prod'],
      ];

      const result = findMatchingRoutes(parentRoute, labels);

      expect(result).toHaveLength(1);
      expect(result[0].route).toBe(childRoute);
      
      // Should track journey through parent and child
      expect(result[0].matchingJourney).toHaveLength(2);
      expect(result[0].matchingJourney[0].route).toBe(parentRoute);
      expect(result[0].matchingJourney[0].matched).toBe(true);
      expect(result[0].matchingJourney[1].route).toBe(childRoute);
      expect(result[0].matchingJourney[1].matched).toBe(true);
    });

    it('should track detailed matching information for each route in journey', () => {
      const childRoute = createRoute([
        { label: 'env', type: '=', value: 'prod' },
        { label: 'region', type: '=', value: 'us-east' },
      ], 'prod-receiver');
      const parentRoute = createRoute([{ label: 'service', type: '=', value: 'web' }], 'web-receiver', [childRoute]);
      const labels: Label[] = [
        ['service', 'web'],
        ['env', 'prod'],
        ['region', 'us-east'],
        ['team', 'backend'],
      ];

      const result = findMatchingRoutes(parentRoute, labels);

      expect(result).toHaveLength(1);
      
      // Parent route matching details
      const parentMatchInfo = result[0].matchingJourney[0];
      expect(parentMatchInfo.route).toBe(parentRoute);
      expect(parentMatchInfo.matched).toBe(true);
      expect(parentMatchInfo.matchDetails).toHaveLength(4); // All labels are checked
      expect(parentMatchInfo.matchDetails[0].match).toBe(true); // service matches
      expect(parentMatchInfo.matchDetails[1].match).toBe(false); // env doesn't have matcher in parent
      expect(parentMatchInfo.matchDetails[2].match).toBe(false); // region doesn't have matcher in parent
      expect(parentMatchInfo.matchDetails[3].match).toBe(false); // team doesn't have matcher in parent

      // Child route matching details
      const childMatchInfo = result[0].matchingJourney[1];
      expect(childMatchInfo.route).toBe(childRoute);
      expect(childMatchInfo.matched).toBe(true);
      expect(childMatchInfo.matchDetails).toHaveLength(4); // All labels are checked
      expect(childMatchInfo.matchDetails[0].match).toBe(false); // service doesn't have matcher in child
      expect(childMatchInfo.matchDetails[1].match).toBe(true); // env matches
      expect(childMatchInfo.matchDetails[2].match).toBe(true); // region matches
      expect(childMatchInfo.matchDetails[3].match).toBe(false); // team doesn't have matcher in child
    });

    it('should track journey for deeply nested routes', () => {
      const grandChildRoute = createRoute([{ label: 'region', type: '=', value: 'us-east' }], 'us-east-receiver');
      const childRoute = createRoute([{ label: 'env', type: '=', value: 'prod' }], 'prod-receiver', [grandChildRoute]);
      const parentRoute = createRoute([{ label: 'service', type: '=', value: 'web' }], 'web-receiver', [childRoute]);
      const labels: Label[] = [
        ['service', 'web'],
        ['env', 'prod'],
        ['region', 'us-east'],
      ];

      const result = findMatchingRoutes(parentRoute, labels);

      expect(result).toHaveLength(1);
      expect(result[0].route).toBe(grandChildRoute);
      
      // Should track journey through all three levels
      expect(result[0].matchingJourney).toHaveLength(3);
      expect(result[0].matchingJourney[0].route).toBe(parentRoute);
      expect(result[0].matchingJourney[0].matched).toBe(true);
      expect(result[0].matchingJourney[1].route).toBe(childRoute);
      expect(result[0].matchingJourney[1].matched).toBe(true);
      expect(result[0].matchingJourney[2].route).toBe(grandChildRoute);
      expect(result[0].matchingJourney[2].matched).toBe(true);
    });

    it('should track journey for multiple matching routes with continue behavior', () => {
      const childRoute1 = createRoute([{ label: 'env', type: '=', value: 'prod' }], 'prod-receiver', [], true);
      const childRoute2 = createRoute([{ label: 'team', type: '=', value: 'backend' }], 'backend-receiver');
      const parentRoute = createRoute([{ label: 'service', type: '=', value: 'web' }], 'web-receiver', [
        childRoute1,
        childRoute2,
      ]);
      const labels: Label[] = [
        ['service', 'web'],
        ['env', 'prod'],
        ['team', 'backend'],
      ];

      const result = findMatchingRoutes(parentRoute, labels);

      expect(result).toHaveLength(2);
      
      // First result (childRoute1)
      expect(result[0].matchingJourney).toHaveLength(2);
      expect(result[0].matchingJourney[0].route).toBe(parentRoute);
      expect(result[0].matchingJourney[0].matched).toBe(true);
      expect(result[0].matchingJourney[1].route).toBe(childRoute1);
      expect(result[0].matchingJourney[1].matched).toBe(true);

      // Second result (childRoute2)
      expect(result[1].matchingJourney).toHaveLength(2);
      expect(result[1].matchingJourney[0].route).toBe(parentRoute);
      expect(result[1].matchingJourney[0].matched).toBe(true);
      expect(result[1].matchingJourney[1].route).toBe(childRoute2);
      expect(result[1].matchingJourney[1].matched).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty routes array', () => {
      const route = createRoute([{ label: 'service', type: '=', value: 'web' }], 'web-receiver', []);
      const labels: Label[] = [['service', 'web']];

      const result = findMatchingRoutes(route, labels);

      expect(result).toHaveLength(1);
      expect(result[0].route).toBe(route);
    });

    it('should handle empty labels array', () => {
      const route = createRoute([], 'default-receiver');
      const labels: Label[] = [];

      const result = findMatchingRoutes(route, labels);

      expect(result).toHaveLength(1);
      expect(result[0].route).toBe(route);
      expect(result[0].labels).toEqual([]);
    });

    it('should handle route with undefined matchers', () => {
      const route: Route = {
        receiver: 'default-receiver',
        routes: [],
        continue: false,
        group_by: [],
        group_wait: '10s',
        group_interval: '5m',
        repeat_interval: '12h',
        mute_time_intervals: [],
        active_time_intervals: [],
        // matchers is undefined
      };
      const labels: Label[] = [['service', 'web']];

      const result = findMatchingRoutes(route, labels);

      expect(result).toHaveLength(1);
      expect(result[0].route).toBe(route);
    });

    it('should handle mixed matching and non-matching children', () => {
      const matchingChild = createRoute([{ label: 'env', type: '=', value: 'prod' }], 'prod-receiver');
      const nonMatchingChild = createRoute([{ label: 'env', type: '=', value: 'staging' }], 'staging-receiver');
      const parentRoute = createRoute([{ label: 'service', type: '=', value: 'web' }], 'web-receiver', [
        nonMatchingChild,
        matchingChild,
      ]);
      const labels: Label[] = [
        ['service', 'web'],
        ['env', 'prod'],
      ];

      const result = findMatchingRoutes(parentRoute, labels);

      expect(result).toHaveLength(1);
      expect(result[0].route).toBe(matchingChild);
      expect(getRoutePath(result[0])).toEqual([parentRoute, matchingChild]);
    });
  });
});

function getRoutePath<T extends Route>(result: RouteMatchResult<T>): T[] {
  return result.matchingJourney.map(step => step.route);
}

function getMatchDetails<T extends Route>(result: RouteMatchResult<T>): LabelMatchDetails[] {
  const lastStep = result.matchingJourney[result.matchingJourney.length - 1];
  return lastStep ? lastStep.matchDetails : [];
}
