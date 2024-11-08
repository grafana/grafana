import { useEffect } from 'react';

import { alertRuleApi } from 'app/features/alerting/unified/api/alertRuleApi';
import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import { ReceiverTypes } from 'app/features/alerting/unified/components/receivers/grafanaAppReceivers/onCall/onCall';
import { useDataSourceFeatures } from 'app/features/alerting/unified/hooks/useCombinedRule';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { Receiver } from 'app/plugins/datasource/alertmanager/types';

export function useIsCreateAlertRuleDone() {
  const [fetchRulerRules, { data, isLoading }] = alertRuleApi.endpoints.rulerRules.useLazyQuery({
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const { dsFeatures, isLoadingDsFeatures } = useDataSourceFeatures(GRAFANA_RULES_SOURCE_NAME);
  const rulerConfig = dsFeatures?.rulerConfig;

  useEffect(() => {
    rulerConfig && fetchRulerRules({ rulerConfig });
  }, [rulerConfig, fetchRulerRules]);

  const rules = data
    ? Object.entries(data).flatMap(([_, groupDto]) => {
        return groupDto.flatMap((group) => group.rules);
      })
    : [];
  const isDone = rules.length > 0;
  return { isDone, isLoading: isLoading || isLoadingDsFeatures };
}

export function isOnCallContactPointReady(contactPoints: Receiver[]) {
  return contactPoints.some((contactPoint: Receiver) =>
    contactPoint.grafana_managed_receiver_configs?.some((receiver) => receiver.type === ReceiverTypes.OnCall)
  );
}

/**
 * @deprecated Will be removed when notification policies is moved to k8s API. Do not use!
 */
export function useGetDefaultContactPoint() {
  const alertmanagerConfiguration = alertmanagerApi.endpoints.getAlertmanagerConfiguration.useQuery(
    GRAFANA_RULES_SOURCE_NAME,
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
      refetchOnMountOrArgChange: true,
    }
  );

  const defaultContactpoint = alertmanagerConfiguration.data?.alertmanager_config?.route?.receiver ?? '';
  return { defaultContactpoint, isLoading: alertmanagerConfiguration.isLoading };
}
