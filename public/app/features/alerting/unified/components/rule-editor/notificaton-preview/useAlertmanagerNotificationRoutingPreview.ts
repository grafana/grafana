import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { useContactPointsWithStatus } from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { useNotificationPolicyRoute } from 'app/features/alerting/unified/components/notification-policies/useNotificationPolicyRoute';

import { Receiver } from '../../../../../../plugins/datasource/alertmanager/types';
import { Labels } from '../../../../../../types/unified-alerting-dto';
import { useRouteGroupsMatcher } from '../../../useRouteGroupsMatcher';
import { addUniqueIdentifierToRoute } from '../../../utils/amroutes';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { AlertInstanceMatch, computeInheritedTree, normalizeRoute } from '../../../utils/notification-policies';

import { RouteWithPath, getRoutesByIdMap } from './route';

export const useAlertmanagerNotificationRoutingPreview = (alertmanager: string, potentialInstances: Labels[]) => {
  const {
    data: currentData,
    isLoading: isPoliciesLoading,
    error: policiesError,
  } = useNotificationPolicyRoute({ alertmanager });

  const {
    contactPoints,
    isLoading: contactPointsLoading,
    error: contactPointsError,
  } = useContactPointsWithStatus({
    alertmanager,
    fetchPolicies: false,
    fetchStatuses: false,
  });

  const { matchInstancesToRoute } = useRouteGroupsMatcher();

  const [defaultPolicy] = currentData ?? [];
  const rootRoute = useMemo(() => {
    if (!defaultPolicy) {
      return;
    }
    return normalizeRoute(addUniqueIdentifierToRoute(defaultPolicy));
  }, [defaultPolicy]);

  // create maps for routes to be get by id, this map also contains the path to the route
  // ⚠️ don't forget to compute the inherited tree before using this map
  const routesByIdMap = rootRoute
    ? getRoutesByIdMap(computeInheritedTree(rootRoute))
    : new Map<string, RouteWithPath>();

  // to create the list of matching contact points we need to first get the rootRoute
  const receiversByName = useMemo(() => {
    if (!contactPoints) {
      return new Map<string, Receiver>();
    }

    // create map for receivers to be get by name
    return contactPoints.reduce((map, receiver) => {
      return map.set(receiver.name, receiver);
    }, new Map<string, Receiver>());
  }, [contactPoints]);

  // match labels in the tree => map of notification policies and the alert instances (list of labels) in each one
  const {
    value: matchingMap = new Map<string, AlertInstanceMatch[]>(),
    loading: matchingLoading,
    error: matchingError,
  } = useAsync(async () => {
    if (!rootRoute) {
      return;
    }

    return await matchInstancesToRoute(rootRoute, potentialInstances, {
      unquoteMatchers: alertmanager !== GRAFANA_RULES_SOURCE_NAME,
    });
  }, [rootRoute, potentialInstances]);

  return {
    routesByIdMap,
    receiversByName,
    matchingMap,
    loading: isPoliciesLoading || contactPointsLoading || matchingLoading,
    error: policiesError ?? contactPointsError ?? matchingError,
  };
};
