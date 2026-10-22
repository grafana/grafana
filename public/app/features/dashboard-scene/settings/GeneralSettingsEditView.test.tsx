import { render, screen } from 'test/test-utils';

import { behaviors, SceneTimeRange } from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';
import { type DashboardMeta } from 'app/types/dashboard';

import { changeDescription } from '../actions/dashboard/changeDescription';
import { changeTitle } from '../actions/dashboard/changeTitle';
import * as utils from '../pages/utils';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../utils/test-utils';

import { GeneralSettingsEditView } from './GeneralSettingsEditView';

jest.mock('app/features/dashboard/components/GenAI/LazyGenAIButtons', () => ({
  LazyGenAIDashTitleButton: () => null,
  LazyGenAIDashDescriptionButton: () => null,
}));

describe('GeneralSettingsEditView', () => {
  describe('Undo/redo history', () => {
    let dashboard: DashboardScene;
    let settings: GeneralSettingsEditView;
    let deactivate: () => void;

    beforeEach(() => {
      dashboard = new DashboardScene({
        $timeRange: new SceneTimeRange({}),
        $behaviors: [new behaviors.CursorSync({ sync: DashboardCursorSync.Off }), new behaviors.LiveNowTimer({})],
        controls: new DashboardControls({}),
        title: 'A',
        isEditing: true,
      });
      deactivate = activateFullSceneTree(dashboard);
      settings = new GeneralSettingsEditView({});
      dashboard.setState({ editview: settings });

      // Leaves one entry in each stack: title A -> B (undo), description change (redo)
      changeTitle({ source: dashboard, oldValue: 'A', newValue: 'B' });
      changeDescription({ source: dashboard, oldValue: undefined, newValue: 'Edited' });
      dashboard.state.sidebar.undoAction();
    });

    afterEach(() => deactivate());

    const expectHistoryLength = (length: number) => {
      expect(dashboard.state.sidebar.state.undoStack).toHaveLength(length);
      expect(dashboard.state.sidebar.state.redoStack).toHaveLength(length);
    };

    it('keeps history when leaving settings without changing anything', () => {
      settings.activate()();

      expectHistoryLength(1);
    });

    it('clears history when leaving after a change, so undo no longer reverts it', () => {
      const deactivateSettings = settings.activate();
      settings.onTitleChange('C');
      deactivateSettings();

      expectHistoryLength(0);
      dashboard.state.sidebar.undoAction();
      expect(dashboard.state.title).toBe('C');
    });

    it('keeps history when a setting is changed and then changed back', () => {
      const deactivateSettings = settings.activate();
      settings.onTitleChange('C');
      settings.onTitleChange('B');
      deactivateSettings();

      expectHistoryLength(1);
    });

    it('keeps history on dashboard state changes that are not settings', () => {
      const deactivateSettings = settings.activate();
      dashboard.setState({ isDirty: true });
      deactivateSettings();

      expectHistoryLength(1);
    });

    it('ignores changes made after settings are left', () => {
      settings.activate()();
      dashboard.setState({ title: 'C' });

      expectHistoryLength(1);
    });

    it.each([
      ['description', () => settings.onDescriptionChange('Other')],
      ['tags', () => settings.onTagsChange(['tag'])],
      ['editable', () => settings.onEditableChange(false)],
      ['preload', () => settings.onPreloadChange(true)],
      ['folder', () => settings.onMoveSuccess('new-folder', 'New folder')],
      [
        'default grid',
        () =>
          settings.onDefaultGridChange(
            dashboard.getDefaultLayoutType() === AutoGridLayoutManager.descriptor.id
              ? DefaultGridLayoutManager.descriptor.id
              : AutoGridLayoutManager.descriptor.id
          ),
      ],
      ['time zone', () => settings.onTimeZoneChange('Europe/Paris')],
      ['week start', () => settings.onWeekStartChange('monday')],
      ['now delay', () => settings.onNowDelayChange('1m')],
      ['refresh intervals', () => settings.onRefreshIntervalChange(['5s'])],
      ['hide time picker', () => settings.onHideTimePickerChange(true)],
      ['live now', () => settings.onLiveNowChange(true)],
      ['graph tooltip', () => settings.onTooltipChange(DashboardCursorSync.Crosshair)],
    ])('clears history when %s changes', (_, change) => {
      const deactivateSettings = settings.activate();
      change();
      deactivateSettings();

      expectHistoryLength(0);
    });
  });

  describe('Dashboard state', () => {
    let dashboard: DashboardScene;
    let settings: GeneralSettingsEditView;

    beforeEach(async () => {
      const result = await buildTestScene();
      dashboard = result.dashboard;
      settings = result.settings;
    });

    it('should return the correct urlKey', () => {
      expect(settings.getUrlKey()).toBe('settings');
    });

    it('should return the dashboard', () => {
      expect(settings.getDashboard()).toBe(dashboard);
    });

    it('should return the dashboard time range', () => {
      expect(settings.getTimeRange()).toBe(dashboard.state.$timeRange);
    });

    it('should return the cursor sync', () => {
      expect(settings.getCursorSync()).toBe(dashboard.state.$behaviors?.[0]);
    });
  });

  describe('Dashboard updates', () => {
    let dashboard: DashboardScene;
    let settings: GeneralSettingsEditView;

    beforeEach(async () => {
      const result = await buildTestScene();
      dashboard = result.dashboard;
      settings = result.settings;
    });

    it('should have isDirty false', () => {
      expect(dashboard.state.isDirty).toBeFalsy();
    });

    it('A change to title updates the dashboard state', () => {
      settings.onTitleChange('new title');

      expect(dashboard.state.title).toBe('new title');
    });

    it('A change to description updates the dashboard state', () => {
      settings.onDescriptionChange('new description');

      expect(dashboard.state.description).toBe('new description');
    });

    it('A change to description updates the dashboard state', () => {
      settings.onTagsChange(['tag1', 'tag2']);

      expect(dashboard.state.tags).toEqual(['tag1', 'tag2']);
    });

    it('A change to editable permissions updates the dashboard state', () => {
      settings.onEditableChange(false);

      expect(dashboard.state.editable).toBe(false);
    });

    it('A change to timezone updates the dashboard state', () => {
      settings.onTimeZoneChange('UTC');
      expect(dashboard.state.$timeRange?.state.timeZone).toBe('UTC');
    });

    it('A change to week start updates the dashboard state', () => {
      settings.onWeekStartChange('monday');

      expect(settings.getTimeRange().state.weekStart).toBe('monday');
    });

    it('A change to refresh interval updates the dashboard state', () => {
      settings.onRefreshIntervalChange(['5s']);
      expect(settings.getRefreshPicker()?.state?.intervals).toEqual(['5s']);
    });

    it('A change to folder updates the dashboard state', async () => {
      const updateNavModel = jest.spyOn(utils, 'updateNavModel').mockImplementation(jest.fn());

      await settings.onFolderChange('folder-2', 'folder 2');

      expect(dashboard.state.meta.folderUid).toBe('folder-2');
      expect(dashboard.state.meta.folderTitle).toBe('folder 2');
      expect(updateNavModel).toHaveBeenCalledWith('folder-2');
    });

    it('A change to tooltip settings updates the dashboard state', () => {
      settings.onTooltipChange(DashboardCursorSync.Crosshair);

      expect(settings.getCursorSync()?.state.sync).toBe(DashboardCursorSync.Crosshair);
    });

    it('A change to time picker visiblity settings updates the dashboard state', () => {
      settings.onHideTimePickerChange(true);

      expect(settings.getDashboardControls()?.state.hideTimeControls).toBe(true);
    });
  });

  describe('Folder field visibility', () => {
    it('renders the Folder field for a normal dashboard', async () => {
      const { settings } = await buildTestScene();
      render(<settings.Component model={settings} />);
      expect(await screen.findByText('Folder')).toBeInTheDocument();
    });

    it('hides the Folder field when the dashboard is a template', async () => {
      const { settings } = await buildTestScene({ canEdit: true, isDashboardTemplate: true });
      render(<settings.Component model={settings} />);

      // Other labels still render
      expect(await screen.findByText('Tags')).toBeInTheDocument();
      // Folder field is gone
      expect(screen.queryByText('Folder')).not.toBeInTheDocument();
    });
  });
});

async function buildTestScene(metaOverrides: Partial<DashboardMeta> = {}) {
  const settings = new GeneralSettingsEditView({});
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({}),
    $behaviors: [new behaviors.CursorSync({ sync: DashboardCursorSync.Off }), new behaviors.LiveNowTimer({})],
    controls: new DashboardControls({}),
    title: 'hello',
    uid: 'dash-1',
    meta: {
      canEdit: true,
      ...metaOverrides,
    },
    editview: settings,
  });

  activateFullSceneTree(dashboard);

  await new Promise((r) => setTimeout(r, 1));

  dashboard.onEnterEditMode();
  settings.activate();

  return { dashboard, settings };
}
