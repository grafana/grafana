import { ScopesFacade } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';

export interface DashboardScopesFacadeState {
  reloadOnParamsChange?: boolean;
  uid?: string;
}

export class DashboardScopesFacade extends ScopesFacade {
  constructor({ reloadOnParamsChange, uid }: DashboardScopesFacadeState) {
    super({
      handler: (facade) => {
        if (!reloadOnParamsChange || !uid) {
          sceneGraph.getTimeRange(facade).onRefresh();
        }
      },
    });
  }
}
