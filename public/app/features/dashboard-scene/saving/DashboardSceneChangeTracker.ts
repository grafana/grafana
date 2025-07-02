import { debounce } from 'lodash';
import { Unsubscribable } from 'rxjs';

import {
  SceneDataLayerSet,
  SceneDataTransformer,
  SceneGridLayout,
  SceneObjectStateChangedEvent,
  SceneQueryRunner,
  SceneRefreshPicker,
  SceneTimeRange,
  SceneVariableSet,
  VizPanel,
  behaviors,
} from '@grafana/scenes';
import { createWorker } from 'app/features/dashboard-scene/saving/createDetectChangesWorker';

import { ConditionalRenderingData } from '../conditional-rendering/ConditionalRenderingData';
import { ConditionalRenderingGroup } from '../conditional-rendering/ConditionalRenderingGroup';
import { ConditionalRenderingTimeRangeSize } from '../conditional-rendering/ConditionalRenderingTimeRangeSize';
import { ConditionalRenderingVariable } from '../conditional-rendering/ConditionalRenderingVariable';
import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardScene, PERSISTED_PROPS } from '../scene/DashboardScene';
import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { VizPanelLinks } from '../scene/PanelLinks';
import { PanelTimeRange } from '../scene/PanelTimeRange';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';
import { isSceneVariableInstance } from '../settings/variables/utils';

import { DashboardChangeInfo } from './shared';

export class DashboardSceneChangeTracker {
  private _changeTrackerSub: Unsubscribable | undefined;
  private _changesWorker?: Worker;
  private _dashboard: DashboardScene;

  constructor(dashboard: DashboardScene) {
    this._dashboard = dashboard;
  }

  static isUpdatingPersistedState({ payload }: SceneObjectStateChangedEvent) {
    // If there are no changes in the state, the check is not needed
    if (Object.keys(payload.partialUpdate).length === 0) {
      return false;
    }

    // Any change in the panel should trigger a change detection
    // The PanelTimeRange includes the overrides configuration
    if (
      payload.changedObject instanceof VizPanel ||
      payload.changedObject instanceof DashboardGridItem ||
      payload.changedObject instanceof PanelTimeRange
    ) {
      return true;
    }
    // SceneQueryRunner includes the DS configuration
    if (payload.changedObject instanceof SceneQueryRunner) {
      if (!Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'data')) {
        return true;
      }
    }
    // SceneDataTransformer includes the transformation configuration
    if (payload.changedObject instanceof SceneDataTransformer) {
      if (!Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'data')) {
        return true;
      }
    }
    if (payload.changedObject instanceof VizPanelLinks) {
      return true;
    }
    if (payload.changedObject instanceof SceneRefreshPicker) {
      if (
        Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'intervals') ||
        Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'refresh')
      ) {
        return true;
      }
    }
    if (payload.changedObject instanceof LibraryPanelBehavior) {
      if (Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'name')) {
        return true;
      }
    }
    if (payload.changedObject instanceof behaviors.CursorSync) {
      return true;
    }
    if (payload.changedObject instanceof SceneDataLayerSet) {
      return true;
    }
    if (payload.changedObject instanceof DashboardGridItem) {
      return true;
    }
    if (payload.changedObject instanceof SceneGridLayout) {
      return true;
    }
    if (payload.changedObject instanceof DashboardScene) {
      if (Object.keys(payload.partialUpdate).some((key) => PERSISTED_PROPS.includes(key))) {
        return true;
      }
    }
    if (payload.changedObject instanceof SceneTimeRange) {
      return true;
    }
    if (payload.changedObject instanceof DashboardControls) {
      if (Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'hideTimeControls')) {
        return true;
      }
    }
    if (payload.changedObject instanceof SceneVariableSet) {
      return true;
    }
    if (payload.changedObject instanceof DashboardAnnotationsDataLayer) {
      if (!Object.prototype.hasOwnProperty.call(payload.partialUpdate, 'data')) {
        return true;
      }
    }
    if (payload.changedObject instanceof behaviors.LiveNowTimer) {
      return true;
    }
    if (isSceneVariableInstance(payload.changedObject)) {
      return true;
    }

    if (payload.changedObject instanceof RowsLayoutManager) {
      return true;
    }
    if (payload.changedObject instanceof RowItem) {
      return true;
    }
    if (payload.changedObject instanceof TabsLayoutManager) {
      return true;
    }
    if (payload.changedObject instanceof TabItem) {
      return true;
    }
    if (payload.changedObject instanceof AutoGridLayoutManager) {
      return true;
    }
    if (payload.changedObject instanceof AutoGridItem) {
      return true;
    }

    if (payload.changedObject instanceof ConditionalRenderingVariable) {
      return true;
    }
    if (payload.changedObject instanceof ConditionalRenderingTimeRangeSize) {
      return true;
    }
    if (payload.changedObject instanceof ConditionalRenderingGroup) {
      return true;
    }
    if (payload.changedObject instanceof ConditionalRenderingData) {
      return true;
    }

    return false;
  }

  private detectSaveModelChanges() {
    const changedDashboard = this._dashboard.getSaveModel();
    const initialDashboard = this._dashboard.getInitialSaveModel();

    // Objects must be stringify to ensure they are clonable, so they don't contain functions
    const changed =
      typeof changedDashboard === 'object' ? JSON.parse(JSON.stringify(changedDashboard)) : changedDashboard;
    const initial =
      typeof initialDashboard === 'object' ? JSON.parse(JSON.stringify(initialDashboard)) : initialDashboard;

    this._changesWorker?.postMessage({ initial, changed });
  }

  private hasMetadataChanges() {
    return this._dashboard.state.meta.folderUid !== this._dashboard.getInitialState()?.meta.folderUid;
  }

  private updateIsDirty(hasChanges: boolean) {
    if (hasChanges || this.hasMetadataChanges()) {
      if (!this._dashboard.state.isDirty) {
        this._dashboard.setState({ isDirty: true });
      }
    } else {
      if (this._dashboard.state.isDirty) {
        this._dashboard.setState({ isDirty: false });
      }
    }
  }

  private init() {
    this._changesWorker = createWorker();
  }

  public startTrackingChanges() {
    if (!this._changesWorker) {
      this.init();
    }

    this._changesWorker!.onmessage = (e: MessageEvent<DashboardChangeInfo>) => {
      this.updateIsDirty(!!e.data.hasChanges);
    };

    const performSaveModelDiff = getChangeTrackerDebouncer(this.detectSaveModelChanges.bind(this));

    this._changeTrackerSub = this._dashboard.subscribeToEvent(
      SceneObjectStateChangedEvent,
      (event: SceneObjectStateChangedEvent) => {
        if (DashboardSceneChangeTracker.isUpdatingPersistedState(event)) {
          performSaveModelDiff();
        }
      }
    );
  }

  public stopTrackingChanges() {
    this._changeTrackerSub?.unsubscribe();
  }

  public terminate() {
    this.stopTrackingChanges();
    this._changesWorker?.terminate();
    this._changesWorker = undefined;
  }
}

/**
 * The debouncer makes unit tests slower and more complex so turning it off for unit tests
 */
function getChangeTrackerDebouncer(fn: () => void) {
  if (process.env.NODE_ENV === 'test') {
    return fn;
  }

  return debounce(fn, 250);
}
