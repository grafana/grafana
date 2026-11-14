import { type VizPanel } from '@grafana/scenes';

import { type DashboardScene } from '../DashboardScene';

export interface PinnedPanel {
  panel: VizPanel;
  height: number;
}

/** Viewer-only state: pinning must not change the saved dashboard or its dirty state. */
export class PanelPinning {
  private panels = new Map<VizPanel, HTMLElement>();
  private listeners = new Set<() => void>();
  private pinned: PinnedPanel | null = null;
  private enabled = true;
  private dock: HTMLElement | null = null;

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getSnapshot = () => this.pinned;

  public register(panel: VizPanel, element: HTMLElement) {
    this.panels.set(panel, element);
    return () => {
      this.panels.delete(panel);
      if (this.pinned?.panel === panel) {
        this.unpin();
      }
    };
  }

  public getOrigin(panel: VizPanel) {
    return this.panels.get(panel);
  }

  public canPin(panel: VizPanel) {
    return this.enabled && this.panels.has(panel);
  }

  public pin(panel: VizPanel) {
    const element = this.panels.get(panel);
    if (!element || !this.enabled) {
      return;
    }
    this.pinned = { panel, height: Math.max(100, element.getBoundingClientRect().height) };
    this.notify();
  }

  public unpin = () => {
    if (this.pinned) {
      this.pinned = null;
      this.notify();
    }
  };

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.unpin();
    }
  }

  public setDock = (dock: HTMLElement | null) => {
    this.dock = dock;
  };

  public getDock() {
    return this.dock;
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

const dashboardPinning = new WeakMap<DashboardScene, PanelPinning>();

export function getPanelPinning(dashboard: DashboardScene) {
  return dashboardPinning.get(dashboard);
}

export function registerPanelPinning(dashboard: DashboardScene, pinning: PanelPinning) {
  dashboardPinning.set(dashboard, pinning);
  return () => {
    dashboardPinning.delete(dashboard);
  };
}
