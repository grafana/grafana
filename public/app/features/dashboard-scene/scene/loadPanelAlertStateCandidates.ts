import { getBackendSrv } from '@grafana/runtime';
import {
  PromAlertingRuleState,
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
  const response = await getBackendSrv().get<PromRulesResponse>(GRAFANA_PROMETHEUS_RULES_URL, {
    dashboard_uid: dashboardUid,
  });

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
          ruleUID: 'folderUid' in rule && 'uid' in rule && typeof rule.uid === 'string' ? rule.uid : undefined,
        },
      ];
    })
  );
}

export function selectMostSevereAlertCandidatePerPanel(candidates: PanelAlertStateCandidate[]) {
  const candidateByPanel = new Map<number, PanelAlertStateCandidate>();

  for (const candidate of candidates) {
    const current = candidateByPanel.get(candidate.panelId);
    if (!current || getAlertStateSeverity(candidate.state) > getAlertStateSeverity(current.state)) {
      candidateByPanel.set(candidate.panelId, candidate);
    }
  }

  return Array.from(candidateByPanel.values());
}

function getAlertStateSeverity(state: PromAlertingRuleState) {
  if (state === PromAlertingRuleState.Firing) {
    return 2;
  }
  if (state === PromAlertingRuleState.Pending) {
    return 1;
  }
  return 0;
}
