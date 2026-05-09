import { generatedAPI } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';

import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

/**
 * Hook to detect if the Grafana Alertmanager has inhibition rules configured,
 * using the k8s API for inhibition rules.
 *
 * Only fetches when the selected alertmanager is the Grafana-managed one,
 * since the k8s API only manages Grafana alertmanager inhibition rules.
 */
export function useHasInhibitionRules(alertmanagerSourceName: string | undefined) {
  const isGrafanaAlertmanager = alertmanagerSourceName === GRAFANA_RULES_SOURCE_NAME;

  const { data, isLoading } = generatedAPI.useListInhibitionRuleQuery({}, { skip: !isGrafanaAlertmanager });

  const hasInhibitionRules = isGrafanaAlertmanager && Array.isArray(data?.items) && data.items.length > 0;

  return { hasInhibitionRules, isLoading: isGrafanaAlertmanager && isLoading };
}
