import { isEqual } from 'lodash';
import { lazy, Suspense } from 'react';

import { behaviors, type SceneComponentProps, sceneGraph, SceneObjectBase } from '@grafana/scenes';
import { type TimeZone } from '@grafana/schema';
import { Spinner, type WeekStart } from '@grafana/ui';

import { updateNavModel } from '../pages/utils';
import { type DashboardScene } from '../scene/DashboardScene';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getDashboardSceneFor } from '../utils/utils';

import { type DashboardEditView, type DashboardEditViewState } from './utils';

const GeneralSettingsEditViewRenderer = lazy(() =>
  import('./SettingsRenderers').then((m) => ({ default: m.GeneralSettingsEditViewRenderer }))
);

function LazyGeneralSettingsEditViewRenderer(props: SceneComponentProps<GeneralSettingsEditView>) {
  return (
    <Suspense fallback={<Spinner />}>
      <GeneralSettingsEditViewRenderer {...props} />
    </Suspense>
  );
}

export interface GeneralSettingsEditViewState extends DashboardEditViewState {
  showMoveModal?: boolean;
  moveModalProps?: {
    targetFolderUID?: string;
  };
}

/**
 * Everything General settings can change. The save model covers all settings except the folder (dashboard meta)
 * and the default grid (not persisted in v1), which undo can still restore: the schema edit undo restores the
 * whole previous dashboard state.
 */
function getSettingsSnapshot(dashboard: DashboardScene) {
  return {
    saveModel: dashboard.getSaveModel(),
    folderUid: dashboard.state.meta.folderUid,
    defaultLayoutType: dashboard.getDefaultLayoutType(),
  };
}

export class GeneralSettingsEditView
  extends SceneObjectBase<GeneralSettingsEditViewState>
  implements DashboardEditView
{
  constructor(state: GeneralSettingsEditViewState) {
    super(state);

    this.addActivationHandler(() => this.onActivate());
  }

  private onActivate() {
    const dashboard = this._dashboard;
    const snapshotOnEnter = getSettingsSnapshot(dashboard);

    // General settings write to the dashboard (and its time range, controls and behaviors) outside edit
    // history, so earlier undo/redo entries could replay over those changes. Comparing a snapshot catches
    // every setting without listing them. Checking on leave is enough because undo/redo is not reachable
    // while settings are open.
    return () => {
      if (!isEqual(getSettingsSnapshot(dashboard), snapshotOnEnter)) {
        dashboard.state.sidebar.clearHistory();
      }
    };
  }

  private get _dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public getUrlKey(): string {
    return 'settings';
  }

  public getDashboard(): DashboardScene {
    return this._dashboard;
  }

  public getTimeRange() {
    return sceneGraph.getTimeRange(this._dashboard);
  }

  public getRefreshPicker() {
    return this.getDashboardControls().state.refreshPicker;
  }

  public getCursorSync() {
    return dashboardSceneGraph.getCursorSync(this._dashboard);
  }

  public getLiveNowTimer(): behaviors.LiveNowTimer {
    const liveNowTimer = sceneGraph.findObject(this._dashboard, (s) => s instanceof behaviors.LiveNowTimer);
    if (liveNowTimer instanceof behaviors.LiveNowTimer) {
      return liveNowTimer;
    } else {
      throw new Error('LiveNowTimer could not be found');
    }
  }

  public getDashboardControls() {
    return this._dashboard.state.controls!;
  }

  public onTitleChange = (value: string) => {
    this._dashboard.setState({ title: value });
  };

  public onDescriptionChange = (value: string) => {
    this._dashboard.setState({ description: value });
  };

  public onTagsChange = (value: string[]) => {
    this._dashboard.setState({ tags: value });
  };

  public onFolderChange = async (newUID: string | undefined, newTitle: string | undefined) => {
    const newMeta = {
      ...this._dashboard.state.meta,
      folderUid: newUID || this._dashboard.state.meta.folderUid,
      folderTitle: newTitle || this._dashboard.state.meta.folderTitle,
    };

    if (newMeta.folderUid) {
      await updateNavModel(newMeta.folderUid);
    }

    this._dashboard.setState({ meta: newMeta });
  };

  public onEditableChange = (value: boolean) => {
    this._dashboard.setState({ editable: value });
  };

  public onDefaultGridChange = (value: string) => {
    if (value === AutoGridLayoutManager.descriptor.id) {
      this._dashboard.updateDefaultLayoutTemplate(AutoGridLayoutManager.createEmpty());
    } else if (value === DefaultGridLayoutManager.descriptor.id) {
      this._dashboard.updateDefaultLayoutTemplate(DefaultGridLayoutManager.createEmpty());
    }
  };

  public onTimeZoneChange = (value: TimeZone) => {
    this.getTimeRange().setState({
      timeZone: value,
    });
  };

  public onWeekStartChange = (value?: WeekStart) => {
    this.getTimeRange().setState({ weekStart: value });
  };

  public onRefreshIntervalChange = (value: string[]) => {
    const control = this.getRefreshPicker();
    control?.setState({
      intervals: value,
    });
  };

  public onNowDelayChange = (value: string) => {
    const timeRange = this.getTimeRange();

    timeRange?.setState({
      UNSAFE_nowDelay: value,
    });
  };

  public onHideTimePickerChange = (value: boolean) => {
    this.getDashboardControls()?.setState({
      hideTimeControls: value,
    });
  };

  public onLiveNowChange = (enable: boolean) => {
    try {
      const liveNow = this.getLiveNowTimer();
      enable ? liveNow.enable() : liveNow.disable();
    } catch (err) {
      console.error(err);
    }
  };

  public onTooltipChange = (value: number) => {
    this.getCursorSync()?.setState({ sync: value });
  };

  public onPreloadChange = (preload: boolean) => {
    this._dashboard.setState({ preload });
  };

  public onDeleteDashboard = () => {};

  public onProvisionedFolderChange = async (newUID?: string) => {
    if (newUID !== this._dashboard.state.meta.folderUid) {
      this.setState({
        showMoveModal: true,
        moveModalProps: { targetFolderUID: newUID },
      });
    }
  };

  public onMoveModalDismiss = () => {
    this.setState({
      showMoveModal: false,
      moveModalProps: undefined,
    });
  };

  static Component = LazyGeneralSettingsEditViewRenderer;
}
