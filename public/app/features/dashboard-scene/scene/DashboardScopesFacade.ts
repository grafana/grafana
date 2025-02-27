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
        this.pushScopeFiltersToAdHocVariable(true);
      },
    });

    this.addActivationHandler(() => {
      // also try to push filters on activation, for
      // when the dashboard is changed
      this.pushScopeFiltersToAdHocVariable();
    });
  }

  private pushScopeFiltersToAdHocVariable(overwrite = false) {
    const dashboard = getDashboardSceneFor(this);

    const adhoc = dashboard.state.$variables?.state.variables.find((v) => v instanceof AdHocFiltersVariable);

    if (!adhoc) {
      return;
    }

    // if there are base filters with source already on the adhoc we don't reconvert the scopes,
    // unless the scopes themselves change and a full overwrite is requested
    if (adhoc.state.baseFilters?.length && adhoc.state.baseFilters.some((filter) => filter.origin) && !overwrite) {
      return;
    }

    const filters = convertScopesToAdHocFilters(this.value);

    adhoc.setState({
      baseFilters: filters,
    });
  }
}
