// This is empty for now, as I think it's not necessary.
// We can most probably rely on $route.current.params, as this is updated on
// GrafanaRoute mount/updates

export class RouteParamsProvider {
  $get = () => {
    throw new Error('TODO: Refactor $routeParams');
  };
}
