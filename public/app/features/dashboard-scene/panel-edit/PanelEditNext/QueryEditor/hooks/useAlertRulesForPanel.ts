import { useMemo } from 'react';

import { AlertState } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { usePanelCombinedRules } from 'app/features/alerting/unified/hooks/usePanelCombinedRules';
import { AlertingRule, CombinedRule } from 'app/types/unified-alerting';

import { promAlertStateToAlertState } from '../../../../scene/AlertStatesDataLayer';
import { getDashboardSceneFor, getPanelIdForVizPanel } from '../../../../utils/utils';
import { PanelDataPaneNext } from '../../PanelDataPaneNext';
import { AlertingState } from '../QueryEditorContext';
import { AlertRule } from '../types';

/**
 * Type guard to check if a rule is an alerting rule with state
 */
function isAlertingRule(rule: CombinedRule['promRule']): rule is AlertingRule {
  return rule?.type === 'alerting';
}

/**
 * Converts a CombinedRule to an AlertRule with state.
 */
function convertToAlertRule(rule: CombinedRule, index: number): AlertRule {
  const state = isAlertingRule(rule.promRule) ? promAlertStateToAlertState(rule.promRule.state) : AlertState.OK;

  return {
    alertId: rule.uid || `alert-${index}`,
    rule,
    state,
  };
}

/**
 * Hook to fetch alert rules for a panel and return AlertingState.
 * Encapsulates the logic for getting dashboard UID and panel ID from the scene graph.
 */
export function useAlertRulesForPanel(dataPane: PanelDataPaneNext, panel: VizPanel): AlertingState {
  const dashboard = getDashboardSceneFor(dataPane);
  const dashboardUID = dashboard.state.uid ?? null;
  const panelId = getPanelIdForVizPanel(panel);

  const { rules, loading } = usePanelCombinedRules({
    dashboardUID,
    panelId,
    poll: false,
  });

  return useMemo(() => {
    const alertRules = rules.map(convertToAlertRule);
    return {
      alertRules,
      loading: loading ?? false,
      isDashboardSaved: !!dashboardUID,
    };
  }, [rules, loading, dashboardUID]);
}
