import { route } from 'angular';

interface RegisterRoutesHandler {
  ($routeProvider: route.IRouteProvider): any;
}

const handlers: RegisterRoutesHandler[] = [];

export function applyRouteRegistrationHandlers($routeProvider: route.IRouteProvider) {
  for (const handler of handlers) {
    handler($routeProvider);
  }
}

export function addRouteRegistrationHandler(fn: RegisterRoutesHandler) {
  handlers.push(fn);
}
