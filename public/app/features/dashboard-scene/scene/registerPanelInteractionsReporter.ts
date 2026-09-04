import { UserActionEvent } from '@grafana/scenes';

import { DashboardInteractions } from '../utils/interactions';

import { type DashboardScene } from './DashboardScene';

export function registerPanelInteractionsReporter(scene: DashboardScene) {
  scene.subscribeToEvent(UserActionEvent, (event) => {
    switch (event.payload.interaction) {
      case 'panel-status-message-clicked':
        DashboardInteractions.panelStatusMessageClicked();
        break;
      case 'panel-cancel-query-clicked':
        DashboardInteractions.panelCancelQueryClicked();
        break;
    }
  });
}
