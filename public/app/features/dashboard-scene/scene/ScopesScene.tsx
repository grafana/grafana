import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import { ScopesDashboardsScene } from './ScopesDashboardsScene';
import { ScopesFiltersScene } from './ScopesFiltersScene';

export interface ScopesSceneState extends SceneObjectState {
  dashboards: ScopesDashboardsScene;
  filters: ScopesFiltersScene;
  isExpanded: boolean;
}

export class ScopesScene extends SceneObjectBase<ScopesSceneState> {
  constructor() {
    super({
      dashboards: new ScopesDashboardsScene(),
      filters: new ScopesFiltersScene(),
      isExpanded: false,
    });
  }

  public setIsExpanded(isExpanded: boolean) {
    this.setState({ isExpanded });
  }

  public fetchScopes() {
    this.state.filters.fetchScopes();
  }

  public getSelectedScope() {
    return this.state.filters.getSelectedScope();
  }
}
