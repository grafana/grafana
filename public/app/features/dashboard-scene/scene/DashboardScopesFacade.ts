import { AdHocFiltersVariable, sceneGraph } from '@grafana/scenes';
import { ScopesFacade } from 'app/features/scopes';

import { getDashboardSceneFor } from '../utils/utils';

import { convertScopesToAdHocFilters } from './convertScopesToAdHocFilters';

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

        // push filters as soon as they come
        this.pushScopeFiltersToAdHocVariable();
      },
    });

    this.addActivationHandler(() => {
      // also try to push filters on activation, for
      // when the dashboard is changed
      this.pushScopeFiltersToAdHocVariable();
    });
  }

  private pushScopeFiltersToAdHocVariable() {
    const dashboard = getDashboardSceneFor(this);

    const adhoc = dashboard.state.$variables?.state.variables.find((v) => v instanceof AdHocFiltersVariable);

    if (!adhoc) {
      return;
    }

    const filters = convertScopesToAdHocFilters(this.value);

    adhoc.setState({
      baseFilters: filters,
    });
  }
}
