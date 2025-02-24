import { reverseScopeFilterOperatorMap } from '@grafana/data/src/types/scopes';
import { AdHocFiltersVariable, sceneGraph } from '@grafana/scenes';
import { FilterSource } from '@grafana/scenes/src/variables/adhoc/AdHocFiltersVariable';
import { ScopesFacade } from 'app/features/scopes';

import { getDashboardSceneFor } from '../utils/utils';

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

    const filters = this.value
      .flatMap((scope) => scope.spec.filters)
      .map((filter) => ({
        key: filter.key,
        operator: reverseScopeFilterOperatorMap[filter.operator],
        value: filter.value,
        values: [filter.value],
        source: FilterSource.Scopes,
      }));

    adhoc.setState({
      baseFilters: filters,
    });
  }
}
