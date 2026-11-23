import { type CustomVariableValue, type FormatVariable, type SceneObject } from '@grafana/scenes';

import { DashboardScene } from './DashboardScene';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from './layout-tabs/TabsLayoutManager';
import { type AnyDashboardLayoutManager } from './types/DashboardLayoutManager';

export class DashboardTabStateMacro implements FormatVariable {
  private static resolving = new WeakSet<DashboardScene>();
  public state: FormatVariable['state'];

  public constructor(
    name: string,
    private sceneObject: SceneObject
  ) {
    this.state = { name, type: 'url_macro' };
  }

  public getValue(): CustomVariableValue | undefined {
    const dashboard = this.sceneObject.getRoot();
    // Tab and row slugs interpolate their titles, which can reference this macro.
    if (!(dashboard instanceof DashboardScene) || DashboardTabStateMacro.resolving.has(dashboard)) {
      return;
    }

    const params = new URLSearchParams();
    DashboardTabStateMacro.resolving.add(dashboard);
    try {
      collectTabState(dashboard.getLayout(), params);
    } finally {
      DashboardTabStateMacro.resolving.delete(dashboard);
    }

    return { formatter: () => params.toString() };
  }
}

function collectTabState(layout: AnyDashboardLayoutManager, params: URLSearchParams) {
  if (layout instanceof TabsLayoutManager) {
    const tab = layout.getCurrentTab();
    if (tab) {
      params.set(layout.getUrlKey(), tab.getSlug());
      collectTabState(tab.getLayout(), params);
    }
  } else if (layout instanceof RowsLayoutManager) {
    for (const row of layout.state.rows) {
      collectTabState(row.getLayout(), params);
      for (const repeat of row.state.repeatedRows ?? []) {
        collectTabState(repeat.getLayout(), params);
      }
    }
  }
}
