interface HasRoutes {
  routes?: HasRoutes[];
}

export function countPolicies(route: HasRoutes): number {
  let count = 0;
  if (route.routes) {
    count += route.routes.length;
    route.routes.forEach((subRoute) => {
      count += countPolicies(subRoute);
    });
  }
  return count;
}
