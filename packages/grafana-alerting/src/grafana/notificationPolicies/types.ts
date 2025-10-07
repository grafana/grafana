import { OverrideProperties } from 'type-fest';

import { RoutingTreeRoute } from '../api/notifications/v0alpha1/notifications.api.gen';
import { LabelMatcher } from '../matchers/types';

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
