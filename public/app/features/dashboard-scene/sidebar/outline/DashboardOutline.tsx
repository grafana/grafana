import { SceneObjectBase, type SceneObjectState } from '@grafana/scenes';

import { DashboardOutlineRenderer } from './DashboardOutlineRenderer';

interface DashboardOutlineState extends SceneObjectState {
  collapsedState: Map<string, boolean>;
  searchQuery: string;
}

export class DashboardOutline extends SceneObjectBase<DashboardOutlineState> {
  public static Component = DashboardOutlineRenderer;

  constructor(state?: Partial<DashboardOutlineState>) {
    super({
      ...state,
      collapsedState: state?.collapsedState ?? new Map<string, boolean>(),
      searchQuery: state?.searchQuery ?? '',
    });
  }

  public getId() {
    return 'outline' as const;
  }

  public isNodeCollapsed(key: string | undefined, defaultCollapsed: boolean): boolean {
    if (key === undefined) {
      return defaultCollapsed;
    }
    return this.state.collapsedState.get(key) ?? defaultCollapsed;
  }

  public setNodeCollapsed(key: string | undefined, collapsed: boolean): void {
    if (key !== undefined) {
      this.state.collapsedState.set(key, collapsed);
    }
  }

  public setSearchQuery(searchQuery: string): void {
    if (this.state.searchQuery !== searchQuery) {
      this.setState({ searchQuery });
    }
  }

  public clone(withState?: Partial<SceneObjectState>): this {
    const cloned = super.clone({
      ...withState,
      collapsedState: this.state.collapsedState,
      searchQuery: this.state.searchQuery,
    });
    return cloned;
  }
}
