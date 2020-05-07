import { DashboardRouteInfo, StoreState } from '../../../types';

export const routeInfoFromPath = (path: string): DashboardRouteInfo => {
  if (path === '/') {
    return DashboardRouteInfo.Home;
  }

  if (path === '/dashboard/new') {
    return DashboardRouteInfo.New;
  }

  return DashboardRouteInfo.Normal;
};

export const getDashboardUid = (state: StoreState): string | undefined => {
  const path = state.location.path;
  const routeInfo = routeInfoFromPath(path);
  const urlUid = state.location.routeParams.uid?.toString();

  if (routeInfo === DashboardRouteInfo.Home) {
    return 'home-dashboard';
  }

  if (routeInfo === DashboardRouteInfo.New) {
    return 'new-dashboard';
  }

  return urlUid;
};
