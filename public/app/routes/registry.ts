interface RegisterRoutesHandler {
  ($routeProvider): any;
}

const handlers: RegisterRoutesHandler[] = [];

export function applyRouteRegistrationHandlers($routeProvider) {
  for (const handler of handlers) {
    handler($routeProvider);
  }
}

export function addRouteRegistrationHandler(fn: RegisterRoutesHandler) {
  handlers.push(fn);
}
