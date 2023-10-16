import { Subscription } from 'rxjs';

import { AnnotationQuery, DashboardCursorSync, dateTimeFormat, DateTimeInput, EventBusSrv } from '@grafana/data';
import { TimeRangeUpdatedEvent } from '@grafana/runtime';
import { behaviors, SceneDataTransformer, sceneGraph, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';

import { findVizPanelByKey, getVizPanelKeyForPanelId } from './utils';

/**
 * Will move this to make it the main way we remain somewhat compatible with getDashboardSrv().getCurrent
 */
export class DashboardModelCompatibilityWrapper {
  public events = new EventBusSrv();
  private _subs = new Subscription();

  public constructor(private _scene: DashboardScene) {
    const timeRange = sceneGraph.getTimeRange(_scene);

    this._subs.add(
      timeRange.subscribeToState((state, prev) => {
        if (state.value !== prev.value) {
          this.events.publish(new TimeRangeUpdatedEvent(state.value));
        }
      })
    );
  }

  public get id(): number | null {
    return this._scene.state.id ?? null;
  }

  public get uid() {
    return this._scene.state.uid ?? null;
  }

  public get title() {
    return this._scene.state.title;
  }

  public get meta() {
    return this._scene.state.meta;
  }

  public get time() {
    const time = sceneGraph.getTimeRange(this._scene);
    return {
      from: time.state.from,
      to: time.state.to,
    };
  }

  /**
   * Used from from timeseries migration handler to migrate time regions to dashboard annotations
   */
  public get annotations(): { list: AnnotationQuery[] } {
    console.error('Scenes DashboardModelCompatibilityWrapper.annotations not implemented (yet)');
    return { list: [] };
  }

  public getTimezone() {
    const time = sceneGraph.getTimeRange(this._scene);
    return time.getTimeZone();
  }

  public sharedTooltipModeEnabled() {
    return this._getSyncMode() > 0;
  }

  public sharedCrosshairModeOnly() {
    return this._getSyncMode() === 1;
  }

  private _getSyncMode() {
    if (this._scene.state.$behaviors) {
      for (const behavior of this._scene.state.$behaviors) {
        if (behavior instanceof behaviors.CursorSync) {
          return behavior.state.sync;
        }
      }
    }

    return DashboardCursorSync.Off;
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

  public getPanelById(id: number): PanelCompatibilityWrapper | null {
    const vizPanel = findVizPanelByKey(this._scene, getVizPanelKeyForPanelId(id));
    if (vizPanel) {
      return new PanelCompatibilityWrapper(vizPanel);
    }

    return null;
  }

  public removePanel(panel: PanelCompatibilityWrapper) {
    // TODO
    console.error('Scenes DashboardModelCompatibilityWrapper.removePanel not implemented (yet)');
  }

  public canEditAnnotations(dashboardUID?: string) {
    // TOOD
    return false;
  }

  public panelInitialized() {}

  public destroy() {
    this.events.removeAllListeners();
    this._subs.unsubscribe();
  }
}

class PanelCompatibilityWrapper {
  constructor(private _vizPanel: VizPanel) {}

  public get type() {
    return this._vizPanel.state.pluginId;
  }

  public get title() {
    return this._vizPanel.state.title;
  }

  public get transformations() {
    if (this._vizPanel.state.$data instanceof SceneDataTransformer) {
      return this._vizPanel.state.$data.state.transformations;
    }

    return [];
  }

  public refresh() {
    console.error('Scenes PanelCompatibilityWrapper.refresh no implemented (yet)');
  }

  public render() {
    console.error('Scenes PanelCompatibilityWrapper.render no implemented (yet)');
  }

  public getQueryRunner() {
    console.error('Scenes PanelCompatibilityWrapper.getQueryRunner no implemented (yet)');
  }
}
