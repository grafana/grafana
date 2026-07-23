import { type OverrideProperties } from 'type-fest';

import { type RoutingTreeRoute } from '../api/notifications';
import { type LabelMatcher } from '../matchers/types';

// type-narrow the route tree
export type Route = OverrideProperties<
  RoutingTreeRoute,
  {
    matchers?: LabelMatcher[];
    routes: Route[];
  }
>;

// a route, but with an identifier – we use this to modify or identify individual routes.
// Mostly used for searching / filtering.
export interface RouteWithID extends Route {
  id: string;
  routes: RouteWithID[];
}
