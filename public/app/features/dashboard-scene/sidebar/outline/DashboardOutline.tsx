import { lazy, Suspense } from 'react';

import { type SceneComponentProps, SceneObjectBase, type SceneObjectState } from '@grafana/scenes';

// The outline renderer pulls in DashboardOutlineNode, which reaches getEditableElementFor
// and every editable element class, so it is loaded on demand when the pane first renders.
const DashboardOutlineRenderer = lazy(() =>
  import(/* webpackChunkName: "dashboard-edit-actions" */ './DashboardOutlineRenderer').then((m) => ({
    default: m.DashboardOutlineRenderer,
  }))
);

function LazyDashboardOutlineRenderer(props: SceneComponentProps<DashboardOutline>) {
  return (
    <Suspense fallback={null}>
      <DashboardOutlineRenderer {...props} />
    </Suspense>
  );
}

interface DashboardOutlineState extends SceneObjectState {
  collapsedState: Map<string, boolean>;
  searchQuery: string;
}

export class DashboardOutline extends SceneObjectBase<DashboardOutlineState> {
  public static Component = LazyDashboardOutlineRenderer;

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
