import { useMemo } from 'react';
import { useAsync } from 'react-use';

import {
  NAMED_ROOT_LABEL_NAME,
  useNotificationPolicyRoute,
} from 'app/features/alerting/unified/components/notification-policies/useNotificationPolicyRoute';

import { Labels } from '../../../../../../types/unified-alerting-dto';
import { useRouteGroupsMatcher } from '../../../useRouteGroupsMatcher';
import { addUniqueIdentifierToRoute } from '../../../utils/amroutes';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { normalizeRoute } from '../../../utils/notification-policies';

export const useAlertmanagerNotificationRoutingPreview = (alertmanager: string, instances: Labels[]) => {
  // if a NAMED_ROOT_LABEL_NAME label exists, then we only match to that route.
  const routeName = useMemo(() => {
    const routeNameLabel = instances.find((instance) => instance[NAMED_ROOT_LABEL_NAME]);
    return routeNameLabel?.[NAMED_ROOT_LABEL_NAME];
  }, [instances]);

  const {
    data: defaultPolicy,
    isLoading: isPoliciesLoading,
    error: policiesError,
  } = useNotificationPolicyRoute({ alertmanager }, routeName);

  // this function will use a web worker to compute matching routes
  const { matchInstancesToRoutes } = useRouteGroupsMatcher();

  const rootRoute = useMemo(() => {
    if (!defaultPolicy) {
      return;
    }
    return normalizeRoute(addUniqueIdentifierToRoute(defaultPolicy));
  }, [defaultPolicy]);

  // match labels in the tree => map of notification policies and the alert instances (list of labels) in each one
  const {
    value: treeMatchingResults = [],
    loading: matchingLoading,
    error: matchingError,
  } = useAsync(async () => {
    if (!rootRoute) {
      return;
    }

    return await matchInstancesToRoutes(rootRoute, instances, {
      unquoteMatchers: alertmanager !== GRAFANA_RULES_SOURCE_NAME,
    });
  }, [rootRoute, instances]);

  return {
    treeMatchingResults,
    isLoading: isPoliciesLoading || matchingLoading,
    error: policiesError ?? matchingError,
  };
};
