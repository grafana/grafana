import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { useNotificationPolicyRoute } from 'app/features/alerting/unified/components/notification-policies/useNotificationPolicyRoute';

import { Labels } from '../../../../../../types/unified-alerting-dto';
import { useRouteGroupsMatcher } from '../../../useRouteGroupsMatcher';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { normalizeRoute } from '../../../utils/notification-policies';

export const useAlertmanagerNotificationRoutingPreview = (alertmanager: string, potentialInstances: Labels[]) => {
  const {
    data: currentData,
    isLoading: isPoliciesLoading,
    error: policiesError,
  } = useNotificationPolicyRoute({ alertmanager });

  const { matchInstancesToRoute } = useRouteGroupsMatcher();

  const [defaultPolicy] = currentData ?? [];
  const rootRoute = useMemo(() => {
    if (!defaultPolicy) {
      return;
    }
    return normalizeRoute(defaultPolicy);
  }, [defaultPolicy]);

  // match labels in the tree => map of notification policies and the alert instances (list of labels) in each one
  const {
    value: matchingMap,
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
    matchingMap,
    loading: isPoliciesLoading || matchingLoading,
    error: policiesError ?? matchingError,
  };
};
