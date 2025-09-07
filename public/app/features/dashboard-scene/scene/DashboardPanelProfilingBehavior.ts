import { SceneObjectBase, SceneObjectState, behaviors } from '@grafana/scenes';
import { getPanelPerformanceCollector } from 'app/features/dashboard/services/PanelPerformanceCollector';

import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';

import { DashboardScene } from './DashboardScene';

/**
 * Behavior that automatically adds VizPanelRenderProfiler to all VizPanels in a dashboard
 * when dashboard profiling is enabled.
 */
export class DashboardPanelProfilingBehavior extends SceneObjectBase<SceneObjectState> {
  private _dashboard?: DashboardScene;
  private _collector = getPanelPerformanceCollector();

  public constructor() {
    super({});

    this.addActivationHandler(() => this._onActivate());
  }

  private _onActivate() {
    const parent = this.parent;
    if (!parent || !(parent instanceof DashboardScene)) {
      console.warn('DashboardPanelProfilingBehavior: No parent dashboard found');
      return;
    }

    this._dashboard = parent;

    // Subscribe to dashboard body changes to add profilers to new panels
    this._subs.add(
      this._dashboard.subscribeToState((newState, prevState) => {
        if (newState.body !== prevState.body) {
          this._attachProfilesToPanels();
        }
      })
    );

    // Attach profilers to existing panels
    this._attachProfilesToPanels();
  }

  private _attachProfilesToPanels() {
    if (!this._dashboard) {
      return;
    }

    // Get all VizPanels from the dashboard
    const panels = dashboardSceneGraph.getVizPanels(this._dashboard);

    panels.forEach((panel) => {
      // Check if profiler already exists
      const existingProfiler = panel.state.$behaviors?.find((b) => b instanceof behaviors.VizPanelRenderProfiler);

      if (!existingProfiler) {
        // Add profiler behavior
        const profiler = new behaviors.VizPanelRenderProfiler({
          collector: this._collector,
        });

        panel.setState({
          $behaviors: [...(panel.state.$behaviors || []), profiler],
        });
      }
    });
  }
}
