import { sceneGraph } from '@grafana/scenes';
import { appEvents } from 'app/core/core';
import { ScopesFacade } from 'app/features/scopes';
import { ReloadDashboardEvent } from 'app/types/events';

export interface DashboardScopesFacadeState {
  reloadOnScopesChange?: boolean;
  uid?: string;
}

export class DashboardScopesFacade extends ScopesFacade {
  constructor({ reloadOnScopesChange, uid }: DashboardScopesFacadeState) {
    super({
      handler: (facade) => {
        if (reloadOnScopesChange && uid) {
          this.reloadDashboard();
        } else {
          sceneGraph.getTimeRange(facade).onRefresh();
        }
      },
    });
  }

  private reloadDashboard() {
    appEvents.publish(new ReloadDashboardEvent());
  }
}
