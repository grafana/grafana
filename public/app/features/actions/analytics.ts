import { reportInteraction } from '@grafana/runtime';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

export interface ActionContext {
  visualizationType?: string;
  panelId?: number;
  dashboardUid?: string;
}

export function getInstrumentationContext(visualizationType: string, panelId?: number): ActionContext {
  return {
    visualizationType,
    panelId,
    dashboardUid: getDashboardSrv().getCurrent()?.uid,
  };
}

export function reportActionTrigger(actionType: string, isOneClick: boolean, context: ActionContext) {
  const { visualizationType, panelId, dashboardUid } = context;

  reportInteraction('dashboards_action_interaction', {
    event: 'dashboards_action_interaction',
    action: 'trigger_action',
    action_type: actionType,
    visualization_type: visualizationType,
    trigger_type: isOneClick ? 'one_click' : 'button',
    context: 'panel_runtime',
    panel_id: panelId,
    dashboard_uid: dashboardUid,
  });
}
