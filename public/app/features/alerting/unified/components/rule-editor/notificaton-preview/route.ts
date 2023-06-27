import { RouteWithID } from '../../../../../../plugins/datasource/alertmanager/types';

export interface RouteWithPath extends RouteWithID {
  path: string[]; // path from root route to this route
}

export function isDefaultPolicy(route: RouteWithPath) {
  return route.path?.length === 0;
}

// we traverse the whole tree and we create a map with <id , RouteWithPath>
export function getRoutesByIdMap(rootRoute: RouteWithID): Map<string, RouteWithPath> {
  const map = new Map<string, RouteWithPath>();

  function addRoutesToMap(route: RouteWithID, path: string[] = []) {
    map.set(route.id, { ...route, path: path });
    route.routes?.forEach((r) => addRoutesToMap(r, [...path, route.id]));
  }

  addRoutesToMap(rootRoute, []);
  return map;
}

export function hasEmptyMatchers(route: RouteWithID) {
  return route.object_matchers?.length === 0;
}
