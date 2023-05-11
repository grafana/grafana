import { useCallback } from 'react';

import { AlertmanagerGroup, RouteWithID } from '../../../../plugins/datasource/alertmanager/types';

export function useRouteGroupsMatcher() {
  const getRouteGroupsMap = useCallback(async (_: RouteWithID, __: AlertmanagerGroup[]) => {
    return new Map<string, AlertmanagerGroup[]>();
  }, []);

  return { getRouteGroupsMap };
}
