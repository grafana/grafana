import { DashboardCursorSync, dateTimeFormat, DateTimeInput, EventBusSrv } from '@grafana/data';
import { behaviors, sceneGraph } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';

/**
 * Will move this to make it the main way we remain somewhat compatible with getDashboardSrv().getCurrent
 */
export class DashboardModelCompatibilityWrapper {
  events = new EventBusSrv();
  panelInitialized() {}

  public getTimezone() {
    const time = sceneGraph.getTimeRange(window.__grafanaSceneContext);
    return time.getTimeZone();
  }

  public sharedTooltipModeEnabled() {
    return this._getSyncMode() > 0;
  }

  public sharedCrosshairModeOnly() {
    return this._getSyncMode() > 1;
  }

  private _getSyncMode() {
    const dashboard = this.getDashboardScene();

    if (dashboard.state.$behaviors) {
      for (const behavior of dashboard.state.$behaviors) {
        if (behavior instanceof behaviors.CursorSync) {
          return behavior.state.sync > 0;
        }
      }
    }

    return DashboardCursorSync.Off;
  }

  private getDashboardScene(): DashboardScene {
    if (window.__grafanaSceneContext instanceof DashboardScene) {
      return window.__grafanaSceneContext;
    }

    throw new Error('Dashboard scene not found');
  }

  public otherPanelInFullscreen(panel: unknown) {
    return false;
  }

  public formatDate(date: DateTimeInput, format?: string) {
    return dateTimeFormat(date, {
      format,
      timeZone: this.getTimezone(),
    });
  }
}
