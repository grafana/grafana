import { reportInteraction } from '@grafana/runtime';

export function reportActionTrigger(actionType: string, isOneClick: boolean, visualizationType: string) {
  reportInteraction('dashboards_action_interaction', {
    event: 'dashboards_action_interaction',
    action: 'trigger_action',
    action_type: actionType,
    visualization_type: visualizationType,
    trigger_type: isOneClick ? 'one_click' : 'button',
    context: 'panel_runtime',
  });
}
