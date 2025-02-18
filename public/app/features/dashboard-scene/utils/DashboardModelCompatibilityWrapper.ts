import { Subscription } from 'rxjs';

import { AnnotationQuery, DashboardCursorSync, dateTimeFormat, DateTimeInput, EventBusSrv } from '@grafana/data';
import { TimeRangeUpdatedEvent } from '@grafana/runtime';
import { behaviors, sceneGraph, SceneObject, VizPanel } from '@grafana/scenes';

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene } from '../scene/DashboardScene';
import { dataLayersToAnnotations } from '../serialization/dataLayersToAnnotations';

import { PanelModelCompatibilityWrapper } from './PanelModelCompatibilityWrapper';
import { findVizPanelByKey, getVizPanelKeyForPanelId } from './utils';

/**
 * Will move this to make it the main way we remain somewhat compatible with getDashboardSrv().getCurrent
 */
export class DashboardModelCompatibilityWrapper {
  public events = new EventBusSrv();
  private _subs = new Subscription();

  public constructor(private _scene: DashboardScene) {
    const timeRange = sceneGraph.getTimeRange(_scene);

    // Copied from DashboardModel, as this function is passed around
    this.formatDate = this.formatDate.bind(this);

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

  public get description() {
    return this._scene.state.description;
  }

  public get editable() {
    return this._scene.state.editable;
  }

  public get graphTooltip() {
    return this._getSyncMode();
  }

  public get timepicker() {
    return {
      refresh_intervals: this._scene.state.controls!.state.refreshPicker.state.intervals,
      hidden: this._scene.state.controls!.state.hideTimeControls ?? false,
    };
  }

  public get timezone() {
    return this.getTimezone();
  }

  public get weekStart() {
    return sceneGraph.getTimeRange(this._scene).state.weekStart;
  }

  public get tags() {
    return this._scene.state.tags;
  }

  public get links() {
    return this._scene.state.links;
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

  public get panels() {
    const panels = findAllObjects(this._scene, (o) => {
      return Boolean(o instanceof VizPanel);
    });
    return panels.map((p) => new PanelModelCompatibilityWrapper(p as VizPanel));
  }

  /**
   * Used from from timeseries migration handler to migrate time regions to dashboard annotations
   */
  public get annotations(): { list: AnnotationQuery[] } {
    const annotations: { list: AnnotationQuery[] } = { list: [] };

    if (this._scene.state.$data instanceof DashboardDataLayerSet) {
      annotations.list = dataLayersToAnnotations(this._scene.state.$data.state.annotationLayers);
    }

    return annotations;
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

  public getPanelById(id: number): PanelModelCompatibilityWrapper | null {
    const vizPanel = findVizPanelByKey(this._scene, getVizPanelKeyForPanelId(id));
    if (vizPanel) {
      return new PanelModelCompatibilityWrapper(vizPanel);
    }

    return null;
  }

  /**
   * Mainly implemented to support Getting started panel's dissmis button.
   */
  public removePanel(panel: PanelModelCompatibilityWrapper) {
    const vizPanel = findVizPanelByKey(this._scene, getVizPanelKeyForPanelId(panel.id));
    if (!vizPanel) {
      console.error('Trying to remove a panel that was not found in scene', panel);
      return;
    }

    this._scene.removePanel(vizPanel);
  }

  public canEditAnnotations(dashboardUID?: string) {
    if (!this._scene.canEditDashboard()) {
      return false;
    }

    if (dashboardUID) {
      return Boolean(this._scene.state.meta.annotationsPermissions?.dashboard.canEdit);
    }

    return Boolean(this._scene.state.meta.annotationsPermissions?.organization.canEdit);
  }

  public panelInitialized() {}

  public destroy() {
    this.events.removeAllListeners();
    this._subs.unsubscribe();
  }

  public hasUnsavedChanges() {
    return this._scene.state.isDirty;
  }
}

function findAllObjects(root: SceneObject, check: (o: SceneObject) => boolean) {
  let result: SceneObject[] = [];
  root.forEachChild((child) => {
    if (check(child)) {
      result.push(child);
    } else {
      result = result.concat(findAllObjects(child, check));
    }
  });

  return result;
}
