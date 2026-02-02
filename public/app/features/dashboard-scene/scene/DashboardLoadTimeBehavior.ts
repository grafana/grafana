import { LoadingState } from '@grafana/data';
import { sceneGraph, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { dashboardLoadTime } from 'app/core/services/dashboardLoadTime_srv';

import { DashboardScene } from './DashboardScene';

interface DashboardLoadTimeBehaviorState extends SceneObjectState {}

/**
 * Tracks panel rendering in scenes dashboards so dashboardLoadTime metrics can be recorded.
 */
export class DashboardLoadTimeBehavior extends SceneObjectBase<DashboardLoadTimeBehaviorState> {
  private panels: VizPanel[] = [];
  private hitRecorded = false;

  constructor(state: DashboardLoadTimeBehaviorState = {}) {
    super(state);

    this.addActivationHandler(() => {
      if (!(this.parent instanceof DashboardScene)) {
        return;
      }

      dashboardLoadTime.reset();
      this.panels = this.findPanels();
      this.panels.forEach((panel) => this.observePanel(panel));
      this.ensureDashboardInfoUpdated();

      return () => {
        this.panels = [];
        this.hitRecorded = false;
        this._subs.unsubscribe();
      };
    });
  }

  private observePanel(panel: VizPanel) {
    const dataNode = sceneGraph.getData(panel);
    if (!dataNode) {
      return;
    }

    const sub = dataNode.subscribeToState(({ data }) => {
      const loadingState = data?.state as LoadingState | undefined;
      if (loadingState === undefined) {
        return;
      }

      this.ensureDashboardInfoUpdated();

      if (!panel.isActive) {
        return;
      }

      dashboardLoadTime.setDashboardPanelRendered(loadingState);
    });

    this._subs.add(sub);
  }

  private ensureDashboardInfoUpdated() {
    const dashboard = this.getDashboard();
    if (!dashboard) {
      return;
    }

    const panelsInView = this.panels.filter((panel) => panel.isActive);
    if (!panelsInView.length) {
      return;
    }

    dashboardLoadTime.setDashboardInfo({
      id: dashboard.state.id ?? '',
      title: dashboard.state.title,
      panelInEdit: Boolean(dashboard.state.editPanel),
      panels: panelsInView.map((panel) => ({
        isInView: true,
        type: panel.state.pluginId,
      })),
    });

    if (!this.hitRecorded) {
      dashboardLoadTime.recordDashboardHit();
      this.hitRecorded = true;
    }
  }

  private findPanels(): VizPanel[] {
    const dashboard = this.getDashboard();
    if (!dashboard) {
      return [];
    }

    return sceneGraph.findAllObjects(dashboard, (obj) => obj instanceof VizPanel) as VizPanel[];
  }

  private getDashboard(): DashboardScene | undefined {
    return this.parent instanceof DashboardScene ? this.parent : undefined;
  }
}
