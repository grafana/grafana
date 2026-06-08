import { useMemo } from 'react';
import { useAsync } from 'react-use';

import {
  NAMED_ROOT_LABEL_NAME,
  useNotificationPolicyRoute,
} from 'app/features/alerting/unified/components/notification-policies/useNotificationPolicyRoute';

import { type Labels } from '../../../../../../types/unified-alerting-dto';
import { useRouteGroupsMatcher } from '../../../useRouteGroupsMatcher';
import { addUniqueIdentifierToRoute } from '../../../utils/amroutes';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { normalizeRoute } from '../../../utils/notification-policies';

export const useAlertmanagerNotificationRoutingPreview = (
  alertmanager: string,
  instances: Labels[],
  policyName?: string
) => {
  // if a policyName is provided (new named-policy routing), use it directly;
  // otherwise fall back to extracting NAMED_ROOT_LABEL_NAME from instance labels (legacy path).
  const routeName = useMemo(() => {
    if (policyName) {
      return policyName;
    }
    const routeNameLabel = instances.find((instance) => instance[NAMED_ROOT_LABEL_NAME]);
    return routeNameLabel?.[NAMED_ROOT_LABEL_NAME];
  }, [policyName, instances]);

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
    const normalized = normalizeRoute(addUniqueIdentifierToRoute(defaultPolicy));
    // k8sRouteToRoute adds a synthetic root matcher (__grafana_managed_route__ = <name>)
    // to tell apart different routing trees. But once we know which tree we want
    // (policyName is set), that matcher just gets in the way — real Alertmanager
    // doesn't know about it. Strip it so instances can actually flow into the sub-routes.
    if (policyName) {
      return { ...normalized, object_matchers: [] };
    }
    return normalized;
  }, [defaultPolicy, policyName]);

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
