import { isEqual } from 'lodash';
import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';
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

interface SettingChange {
  perform(): void;
  undo(): void;
}

function captureSetting<T>(
  read: () => T,
  write: (value: T) => void,
  equals: (before: T, after: T) => boolean = isEqual
): () => SettingChange | undefined {
  const before = read();

  return () => {
    const after = read();
    if (equals(before, after)) {
      return undefined;
    }

    return {
      perform: () => write(after),
      undo: () => write(before),
    };
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
    const sidebar = dashboard.state.sidebar;
    const timeRange = this.getTimeRange();
    const controls = dashboard.state.controls;
    const captures = this.captureSettings(dashboard);

    return () => {
      // Discard and schema edits can close settings while replacing the objects being edited.
      if (
        !dashboard.state.isEditing ||
        dashboard.state.sidebar !== sidebar ||
        dashboard.state.controls !== controls ||
        sceneGraph.getTimeRange(dashboard) !== timeRange
      ) {
        return;
      }

      const changes = captures
        .map((finish) => finish())
        .filter((change): change is SettingChange => change !== undefined);
      if (changes.length === 0) {
        return;
      }

      sidebar.recordCompletedEdit({
        source: dashboard,
        meta: { actionId: 'dashboard.changeSettings' },
        description: t('dashboard.edit-actions.change-settings', 'Change dashboard settings'),
        perform: () => changes.forEach((change) => change.perform()),
        undo: () => [...changes].reverse().forEach((change) => change.undo()),
      });
    };
  }

  private captureSettings(dashboard: DashboardScene) {
    const timeRange = this.getTimeRange();
    const controls = dashboard.state.controls;
    const refreshPicker = controls?.state.refreshPicker;
    const cursorSync = this.getCursorSync();
    const liveNow = sceneGraph.findObject(dashboard, (object) => object instanceof behaviors.LiveNowTimer);

    const captures = [
      captureSetting(
        () => dashboard.state.title,
        (title) => dashboard.setState({ title })
      ),
      captureSetting(
        () => dashboard.state.description,
        (description) => dashboard.setState({ description })
      ),
      captureSetting(
        () => dashboard.state.tags?.slice(),
        (tags) => dashboard.setState({ tags: tags?.slice() })
      ),
      captureSetting(
        () => dashboard.state.editable,
        (editable) => dashboard.setState({ editable })
      ),
      captureSetting(
        () => dashboard.state.preload,
        (preload) => dashboard.setState({ preload })
      ),
      captureSetting(
        () => timeRange.state.timeZone,
        (timeZone) => timeRange.setState({ timeZone })
      ),
      captureSetting(
        () => timeRange.state.weekStart,
        (weekStart) => timeRange.setState({ weekStart })
      ),
      captureSetting(
        () => timeRange.state.UNSAFE_nowDelay,
        (UNSAFE_nowDelay) => timeRange.setState({ UNSAFE_nowDelay })
      ),
      captureSetting(
        () => dashboard.state.preferences,
        (preferences) => dashboard.setState({ preferences }),
        (before, after) => before?.defaultLayoutTemplate?.descriptor.id === after?.defaultLayoutTemplate?.descriptor.id
      ),
    ];

    if (controls) {
      captures.push(
        captureSetting(
          () => controls.state.hideTimeControls,
          (hideTimeControls) => controls.setState({ hideTimeControls })
        )
      );
    }
    if (refreshPicker) {
      captures.push(
        captureSetting(
          () => refreshPicker.state.intervals?.slice(),
          (intervals) => refreshPicker.setState({ intervals: intervals?.slice() })
        )
      );
    }
    if (cursorSync) {
      captures.push(
        captureSetting(
          () => cursorSync.state.sync,
          (sync) => cursorSync.setState({ sync })
        )
      );
    }
    if (liveNow instanceof behaviors.LiveNowTimer) {
      captures.push(
        captureSetting(
          () => liveNow.state.enabled,
          (enabled) => (enabled ? liveNow.enable() : liveNow.disable())
        )
      );
    }
    if (!dashboard.isManagedRepository()) {
      captures.push(
        captureSetting(
          () => ({ folderUid: dashboard.state.meta.folderUid, folderTitle: dashboard.state.meta.folderTitle }),
          (folder) => {
            dashboard.setState({ meta: { ...dashboard.state.meta, ...folder } });
            if (folder.folderUid) {
              void updateNavModel(folder.folderUid);
            }
          }
        )
      );
    }

    return captures;
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
    const dashboard = this._dashboard;
    const newMeta = {
      ...dashboard.state.meta,
      folderUid: newUID || dashboard.state.meta.folderUid,
      folderTitle: newTitle || dashboard.state.meta.folderTitle,
    };

    dashboard.setState({ meta: newMeta });

    if (newMeta.folderUid) {
      await updateNavModel(newMeta.folderUid);
    }
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
