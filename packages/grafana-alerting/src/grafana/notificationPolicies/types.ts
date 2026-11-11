import { type RoutingTreeRoute } from '../api/notifications';
import { type LabelMatcher } from '../matchers/types';

// Keep recursive children outside mapped types so inherited route fields remain visible to TypeScript.
export interface Route extends Omit<RoutingTreeRoute, 'matchers' | 'routes'> {
  matchers?: LabelMatcher[];
  routes: Route[];
}

// a route, but with an identifier – we use this to modify or identify individual routes.
// Mostly used for searching / filtering.
export interface RouteWithID extends Route {
  id: string;
  routes: RouteWithID[];
}

/**
 * The fields `computeInheritedTree` and `getInheritedProperties` read from a route. Asking for only
 * these lets callers pass their own route types, for example routes from a Prometheus Alertmanager
 * config, whose matchers are strings.
 */
export interface InheritableRoute
  extends Partial<
    Pick<RoutingTreeRoute, 'receiver' | 'group_by' | 'group_wait' | 'group_interval' | 'repeat_interval'>
  > {
  routes?: InheritableRoute[];
}

/**
 * The fields `findMatchingRoutes` reads from a route. Callers with their own route types only need
 * to turn their matchers into `LabelMatcher`s first.
 */
export interface MatchableRoute {
  matchers?: LabelMatcher[];
  continue?: boolean;
  routes?: MatchableRoute[];
}
