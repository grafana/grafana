import { getBackendSrv } from '@grafana/runtime';
import {
  type PromAlertingRuleState,
  type PromRuleGroupDTO,
  PromRuleType,
  type PromRulesResponse,
} from 'app/types/unified-alerting-dto';

const GRAFANA_PROMETHEUS_RULES_URL = 'api/prometheus/grafana/api/v1/rules';
const PANEL_ID_ANNOTATION = '__panelId__';

export interface PanelAlertStateCandidate {
  panelId: number;
  state: PromAlertingRuleState;
  ruleUID?: string;
}

export async function loadDashboardAlertRuleGroups(dashboardUid: string): Promise<PromRuleGroupDTO[]> {
  const searchParams = new URLSearchParams({ dashboard_uid: dashboardUid });
  const response = await getBackendSrv().get<PromRulesResponse>(
    GRAFANA_PROMETHEUS_RULES_URL,
    Object.fromEntries(searchParams)
  );

  return response.data.groups;
}

export async function loadPanelAlertStateCandidates(dashboardUid: string): Promise<PanelAlertStateCandidate[]> {
  const groups = await loadDashboardAlertRuleGroups(dashboardUid);

  return groups.flatMap((group) =>
    group.rules.flatMap((rule) => {
      if (rule.type !== PromRuleType.Alerting || !rule.annotations?.[PANEL_ID_ANNOTATION]) {
        return [];
      }

      return [
        {
          panelId: Number(rule.annotations[PANEL_ID_ANNOTATION]),
          state: rule.state,
          ruleUID: 'folderUid' in rule && 'uid' in rule ? rule.uid : undefined,
        },
      ];
    })
  );
}
