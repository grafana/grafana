import { render, screen } from 'test/test-utils';

import { behaviors, SceneTimeRange } from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';
import { type DashboardMeta } from 'app/types/dashboard';

import { edit } from '../actions/utils/edit';
import * as utils from '../pages/utils';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardScene } from '../scene/DashboardScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { GeneralSettingsEditView } from './GeneralSettingsEditView';

jest.mock('app/features/dashboard/components/GenAI/LazyGenAIButtons', () => ({
  LazyGenAIDashTitleButton: () => null,
  LazyGenAIDashDescriptionButton: () => null,
}));

describe('GeneralSettingsEditView', () => {
  describe('Edit history', () => {
    let dashboard: DashboardScene;
    let settings: GeneralSettingsEditView;

    beforeEach(async () => {
      ({ dashboard } = await buildTestScene());
      edit({
        source: dashboard,
        description: 'Change title',
        meta: { actionId: 'dashboard.changeTitle' },
        perform: () => dashboard.setState({ title: 'Edited title' }),
        undo: () => dashboard.setState({ title: 'hello' }),
      });
      edit({
        source: dashboard,
        description: 'Change description',
        meta: { actionId: 'dashboard.changeDescription' },
        perform: () => dashboard.setState({ description: 'Edited description' }),
        undo: () => dashboard.setState({ description: undefined }),
      });
      dashboard.state.sidebar.undoAction();

      // Entering settings creates a new view
      settings = new GeneralSettingsEditView({});
      dashboard.setState({ editview: settings });
      settings.activate();
    });

    it('keeps undo and redo history while no setting is changed', () => {
      const { sidebar } = dashboard.state;

      expect(sidebar.state.undoStack.map((action) => action.description)).toEqual(['Change title']);
      expect(sidebar.state.redoStack.map((action) => action.description)).toEqual(['Change description']);
    });

    it.each([
      { name: 'title', change: (view: GeneralSettingsEditView) => view.onTitleChange('Settings title') },
      { name: 'time zone', change: (view: GeneralSettingsEditView) => view.onTimeZoneChange('UTC') },
      { name: 'graph tooltip', change: (view: GeneralSettingsEditView) => view.onTooltipChange(1) },
      { name: 'hide time picker', change: (view: GeneralSettingsEditView) => view.onHideTimePickerChange(true) },
    ])('clears undo and redo history when the $name setting changes', ({ change }) => {
      const { sidebar } = dashboard.state;

      change(settings);

      expect(sidebar.state.undoStack).toEqual([]);
      expect(sidebar.state.redoStack).toEqual([]);
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
