import { alertRuleApi } from 'app/features/alerting/unified/api/alertRuleApi';
import { ungroupRulesByFileName } from 'app/features/alerting/unified/api/prometheus';
import { Annotation, GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/constants';
import { prometheusRuleType } from 'app/features/alerting/unified/utils/rules';
import { dispatch } from 'app/store/store';
import { type PromAlertingRuleState } from 'app/types/unified-alerting-dto';

export interface PanelAlertStateCandidate {
  panelId: number;
  state: PromAlertingRuleState;
  ruleUID?: string;
}

export async function loadPanelAlertStateCandidates(dashboardUid: string): Promise<PanelAlertStateCandidate[]> {
  const promRules = await dispatch(
    alertRuleApi.endpoints.prometheusRuleNamespaces.initiate(
      {
        ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
        dashboardUid,
      },
      { forceRefetch: true }
    )
  );

  if (promRules.error) {
    throw new Error('Unexpected alert rules response.');
  }

  return ungroupRulesByFileName(promRules.data).flatMap((group) =>
    group.rules.flatMap((rule) => {
      if (!prometheusRuleType.alertingRule(rule) || !rule.annotations?.[Annotation.panelID]) {
        return [];
      }

      return [
        {
          panelId: Number(rule.annotations[Annotation.panelID]),
          state: rule.state,
          ruleUID: prometheusRuleType.grafana.alertingRule(rule) ? rule.uid : undefined,
        },
      ];
    })
  );
}
