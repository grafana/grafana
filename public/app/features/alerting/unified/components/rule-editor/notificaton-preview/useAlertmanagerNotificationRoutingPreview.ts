import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { Receiver } from '../../../../../../plugins/datasource/alertmanager/types';
import { Labels } from '../../../../../../types/unified-alerting-dto';
import { useAlertmanagerConfig } from '../../../hooks/useAlertmanagerConfig';
import { useRouteGroupsMatcher } from '../../../useRouteGroupsMatcher';
import { addUniqueIdentifierToRoute } from '../../../utils/amroutes';
import { AlertInstanceMatch, computeInheritedTree, normalizeRoute } from '../../../utils/notification-policies';

import { getRoutesByIdMap, RouteWithPath } from './route';

export const useAlertmanagerNotificationRoutingPreview = (
  alertManagerSourceName: string,
  potentialInstances: Labels[]
) => {
  const { currentData, isLoading: configLoading, error: configError } = useAlertmanagerConfig(alertManagerSourceName);
  const config = currentData?.alertmanager_config;

  const { matchInstancesToRoute } = useRouteGroupsMatcher();

  // to create the list of matching contact points we need to first get the rootRoute
  const { rootRoute, receivers } = useMemo(() => {
    if (!config) {
      return {
        receivers: [],
        rootRoute: undefined,
      };
    }

    return {
      rootRoute: config.route ? normalizeRoute(addUniqueIdentifierToRoute(config.route)) : undefined,
      receivers: config.receivers ?? [],
    };
  }, [config]);

  // create maps for routes to be get by id, this map also contains the path to the route
  // ⚠️ don't forget to compute the inherited tree before using this map
  const routesByIdMap: Map<string, RouteWithPath> = rootRoute
    ? getRoutesByIdMap(computeInheritedTree(rootRoute))
    : new Map();

  // create map for receivers to be get by name
  const receiversByName =
    receivers.reduce((map, receiver) => {
      return map.set(receiver.name, receiver);
    }, new Map<string, Receiver>()) ?? new Map<string, Receiver>();

  // match labels in the tree => map of notification policies and the alert instances (list of labels) in each one
  const {
    value: matchingMap = new Map<string, AlertInstanceMatch[]>(),
    loading: matchingLoading,
    error: matchingError,
  } = useAsync(async () => {
    if (!rootRoute) {
      return;
    }
    return await matchInstancesToRoute(rootRoute, potentialInstances);
  }, [rootRoute, potentialInstances]);

  return {
    routesByIdMap,
    receiversByName,
    matchingMap,
    loading: configLoading || matchingLoading,
    error: configError ?? matchingError,
  };
};
