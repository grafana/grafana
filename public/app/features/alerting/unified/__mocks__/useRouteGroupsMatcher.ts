import { useCallback } from 'react';

import { AlertmanagerGroup, RouteWithID } from '../../../../plugins/datasource/alertmanager/types';

export function useRouteGroupsMatcher() {
  const getRouteGroupsMap = useCallback(async (route: RouteWithID, __: AlertmanagerGroup[]) => {
    const groupsMap = new Map<string, AlertmanagerGroup[]>();
    function addRoutes(route: RouteWithID) {
      groupsMap.set(route.id, []);

      route.routes?.forEach((r) => addRoutes(r));
    }

    addRoutes(route);

    return groupsMap;
  }, []);

  return { getRouteGroupsMap };
}
