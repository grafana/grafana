import { VizPanel } from '@grafana/scenes';

import { DashboardLayoutManager } from '../types/DashboardLayoutManager';

export class LayoutRestorer {
  private layoutMap: Record<string, DashboardLayoutManager> = {};

  public getLayout(
    newLayout: DashboardLayoutManager,
    currentLayout: DashboardLayoutManager
  ): DashboardLayoutManager | undefined {
    //If we have an old version of this layout and panels are the same we can reuse it
    const prevLayout = this.layoutMap[newLayout.descriptor.id];
    if (prevLayout) {
      if (panelsAreUnchanged(prevLayout.getVizPanels(), newLayout.getVizPanels())) {
        return prevLayout;
      }
    }

    this.layoutMap[currentLayout.descriptor.id] = currentLayout;

    return newLayout;
  }
}

/**
 * Simple check that panels are in same order and same options but not a comprehensive check
 * Ideally we should check if persisted state is the same but not possible anymore with current serialization code that requires all panels be connected to a DashboardScene
 */
function panelsAreUnchanged(a: VizPanel[], b: VizPanel[]) {
  if (a.length < b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    const ap = a[i];
    const bp = b[i];

    if (ap.state.key !== bp.state.key) {
      return false;
    }

    if (JSON.stringify(ap.state.options) !== JSON.stringify(bp.state.options)) {
      return false;
    }

    if (JSON.stringify(ap.state.fieldConfig) !== JSON.stringify(bp.state.fieldConfig)) {
      return false;
    }
  }

  return true;
}
