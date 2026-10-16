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
