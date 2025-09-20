import { RoutingTreeRoute } from '../api/v0alpha1/api.gen';

// type-narrow the route tree
export type Route = RoutingTreeRoute;

// a route, but with an identifier – we use this to modify or identify individual routes.
// Mostly used for searching / filtering.
export interface RouteWithID extends Route {
  id: string;
  routes: RouteWithID[];
}
