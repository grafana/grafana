import { locationService } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { ScopesFacade } from 'app/features/scopes';

export interface DashboardScopesFacadeState {
  reloadOnScopesChange?: boolean;
  uid?: string;
}

export class DashboardScopesFacade extends ScopesFacade {
  constructor({ reloadOnScopesChange, uid }: DashboardScopesFacadeState) {
    super({
      handler: (facade) => {
        if (reloadOnScopesChange && uid) {
          locationService.reload();
        } else {
          sceneGraph.getTimeRange(facade).onRefresh();
        }
      },
    });
  }
}
