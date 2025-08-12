import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { useNotificationPolicyRoute } from 'app/features/alerting/unified/components/notification-policies/useNotificationPolicyRoute';

import { Labels } from '../../../../../../types/unified-alerting-dto';
import { useRouteGroupsMatcher } from '../../../useRouteGroupsMatcher';
import { addUniqueIdentifierToRoute } from '../../../utils/amroutes';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { normalizeRoute } from '../../../utils/notification-policies';

export const useAlertmanagerNotificationRoutingPreview = (alertmanager: string, instances: Labels[]) => {
  const {
    data: currentData,
    isLoading: isPoliciesLoading,
    error: policiesError,
  } = useNotificationPolicyRoute({ alertmanager });

  const { matchInstancesToRoutes } = useRouteGroupsMatcher();

  const [defaultPolicy] = currentData ?? [];
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
