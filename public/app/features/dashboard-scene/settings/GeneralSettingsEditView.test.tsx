import { render, screen } from 'test/test-utils';

import { behaviors, SceneRefreshPicker, SceneTimeRange } from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';
import { defaultSpec as defaultDashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type DashboardMeta } from 'app/types/dashboard';

import { applyDashboardSpec } from '../actions/dashboard/applyDashboardSpec';
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
      jest.spyOn(utils, 'updateNavModel').mockResolvedValue();
      dashboard = new DashboardScene({
        $timeRange: new SceneTimeRange({ timeZone: 'UTC' }),
        $behaviors: [new behaviors.CursorSync({ sync: DashboardCursorSync.Off }), new behaviors.LiveNowTimer({})],
        controls: new DashboardControls({
          hideTimeControls: false,
          refreshPicker: new SceneRefreshPicker({ intervals: ['10s'] }),
        }),
        preferences: { defaultLayoutTemplate: DefaultGridLayoutManager.createEmpty() },
        meta: { folderUid: 'original-folder', folderTitle: 'Original folder' },
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

    afterEach(() => {
      deactivate();
      jest.restoreAllMocks();
    });

    const expectHistoryLength = (length: number) => {
      expect(dashboard.state.sidebar.state.undoStack).toHaveLength(length);
      expect(dashboard.state.sidebar.state.redoStack).toHaveLength(length);
    };

    it('when settings are left unchanged, both history stacks are preserved', () => {
      settings.activate()();

      expectHistoryLength(1);
    });

    it('when several settings change, one undo step restores them and preserves earlier edits', () => {
      const timeRange = settings.getTimeRange();
      timeRange.setState({ timeZone: 'UTC' });
      const body = dashboard.state.body;
      const deactivateSettings = settings.activate();

      settings.onTitleChange('C');
      settings.onTimeZoneChange('Europe/Paris');
      deactivateSettings();

      const sidebar = dashboard.state.sidebar;
      expect(sidebar.state.undoStack).toHaveLength(2);
      expect(sidebar.state.redoStack).toHaveLength(0);
      expect(dashboard.state.title).toBe('C');
      expect(timeRange.state.timeZone).toBe('Europe/Paris');

      sidebar.undoAction();

      expect(dashboard.state.title).toBe('B');
      expect(timeRange.state.timeZone).toBe('UTC');
      expect(dashboard.state.body).toBe(body);
      expect(dashboard.state.$timeRange).toBe(timeRange);

      sidebar.undoAction();

      expect(dashboard.state.title).toBe('A');

      sidebar.redoAction();
      sidebar.redoAction();

      expect(dashboard.state.title).toBe('C');
      expect(timeRange.state.timeZone).toBe('Europe/Paris');
    });

    it('when a setting is changed back to its original value, both history stacks are preserved', () => {
      const deactivateSettings = settings.activate();
      settings.onTitleChange('C');
      settings.onTitleChange('B');
      deactivateSettings();

      expectHistoryLength(1);
    });

    it('when unrelated dashboard state changes, no settings action is recorded', () => {
      const deactivateSettings = settings.activate();
      dashboard.setState({ isDirty: true });
      deactivateSettings();

      expectHistoryLength(1);
    });

    it('when settings have been left, later changes are not recorded as settings edits', () => {
      settings.activate()();
      dashboard.setState({ title: 'C' });

      expectHistoryLength(1);
    });

    it.each<{
      name: string;
      change: () => void | Promise<void>;
      read: () => unknown;
      before: unknown;
      after: unknown;
    }>([
      {
        name: 'description',
        change: () => settings.onDescriptionChange('Other'),
        read: () => dashboard.state.description,
        before: undefined,
        after: 'Other',
      },
      {
        name: 'tags',
        change: () => settings.onTagsChange(['tag']),
        read: () => dashboard.state.tags,
        before: undefined,
        after: ['tag'],
      },
      {
        name: 'editable',
        change: () => settings.onEditableChange(false),
        read: () => dashboard.state.editable,
        before: true,
        after: false,
      },
      {
        name: 'preload',
        change: () => settings.onPreloadChange(true),
        read: () => dashboard.state.preload,
        before: undefined,
        after: true,
      },
      {
        name: 'folder',
        change: () => settings.onFolderChange('new-folder', 'New folder'),
        read: () => ({ folderUid: dashboard.state.meta.folderUid, folderTitle: dashboard.state.meta.folderTitle }),
        before: { folderUid: 'original-folder', folderTitle: 'Original folder' },
        after: { folderUid: 'new-folder', folderTitle: 'New folder' },
      },
      {
        name: 'default grid',
        change: () => settings.onDefaultGridChange(AutoGridLayoutManager.descriptor.id),
        read: () => dashboard.getDefaultLayoutType(),
        before: DefaultGridLayoutManager.descriptor.id,
        after: AutoGridLayoutManager.descriptor.id,
      },
      {
        name: 'time zone',
        change: () => settings.onTimeZoneChange('Europe/Paris'),
        read: () => settings.getTimeRange().state.timeZone,
        before: 'UTC',
        after: 'Europe/Paris',
      },
      {
        name: 'week start',
        change: () => settings.onWeekStartChange('monday'),
        read: () => settings.getTimeRange().state.weekStart,
        before: undefined,
        after: 'monday',
      },
      {
        name: 'now delay',
        change: () => settings.onNowDelayChange('1m'),
        read: () => settings.getTimeRange().state.UNSAFE_nowDelay,
        before: undefined,
        after: '1m',
      },
      {
        name: 'refresh intervals',
        change: () => settings.onRefreshIntervalChange(['5s']),
        read: () => settings.getRefreshPicker().state.intervals,
        before: ['10s'],
        after: ['5s'],
      },
      {
        name: 'hide time picker',
        change: () => settings.onHideTimePickerChange(true),
        read: () => settings.getDashboardControls().state.hideTimeControls,
        before: false,
        after: true,
      },
      {
        name: 'live now',
        change: () => settings.onLiveNowChange(true),
        read: () => settings.getLiveNowTimer().state.enabled,
        before: false,
        after: true,
      },
      {
        name: 'graph tooltip',
        change: () => settings.onTooltipChange(DashboardCursorSync.Crosshair),
        read: () => settings.getCursorSync()?.state.sync,
        before: DashboardCursorSync.Off,
        after: DashboardCursorSync.Crosshair,
      },
    ])('when $name changes, undo and redo restore its values', async ({ change, read, before, after }) => {
      const deactivateSettings = settings.activate();
      expect(read()).toEqual(before);

      await change();
      deactivateSettings();

      const sidebar = dashboard.state.sidebar;
      expect(read()).toEqual(after);
      expect(sidebar.state.undoStack).toHaveLength(2);
      expect(sidebar.state.redoStack).toHaveLength(0);

      sidebar.undoAction();

      expect(read()).toEqual(before);
      expect(dashboard.state.title).toBe('B');

      sidebar.redoAction();

      expect(read()).toEqual(after);
    });

    it('when settings are changed on separate visits, each visit has its own undo step', () => {
      const closeFirstVisit = settings.activate();
      settings.onTitleChange('First visit');
      closeFirstVisit();
      const nextSettings = new GeneralSettingsEditView({});
      dashboard.setState({ editview: nextSettings });
      const closeSecondVisit = nextSettings.activate();
      nextSettings.onTitleChange('Second visit');
      closeSecondVisit();
      const sidebar = dashboard.state.sidebar;

      expect(sidebar.state.undoStack).toHaveLength(3);
      expect(dashboard.state.title).toBe('Second visit');

      sidebar.undoAction();
      expect(dashboard.state.title).toBe('First visit');

      sidebar.undoAction();
      expect(dashboard.state.title).toBe('B');

      sidebar.redoAction();
      expect(dashboard.state.title).toBe('First visit');

      sidebar.redoAction();
      expect(dashboard.state.title).toBe('Second visit');
    });

    it.each([
      {
        name: 'leaving edit mode',
        discard: () => dashboard.exitEditMode({ skipConfirm: true, restoreInitialState: true }),
        isEditing: false,
      },
      {
        name: 'keeping edit mode',
        discard: () => dashboard.discardChangesAndKeepEditing(),
        isEditing: true,
      },
    ])('when changes are discarded while $name, closing settings records no action', ({ discard, isEditing }) => {
      dashboard.setState({ isEditing: false });
      dashboard.onEnterEditMode();
      const sidebar = dashboard.state.sidebar;
      const closeSettings = settings.activate();
      settings.onTitleChange('Discarded title');

      discard();
      closeSettings();

      expect(dashboard.state.title).toBe('B');
      expect(dashboard.state.isEditing).toBe(isEditing);
      expect(dashboard.state.sidebar.state.undoStack).toEqual([]);
      expect(dashboard.state.sidebar.state.redoStack).toEqual([]);
      expect(sidebar.state.undoStack).toEqual([]);
    });

    it('when settings follow a schema edit, both edits can be undone and redone', () => {
      // Only history needs activation here; activating the rebuilt dashboard would start annotation queries.
      deactivate();
      deactivate = dashboard.state.sidebar.activate();
      dashboard.setState({ editview: undefined });
      const originalBody = dashboard.state.body;
      const spec = defaultDashboardV2Spec();
      spec.title = 'Schema title';
      spec.timeSettings.timezone = 'UTC';
      spec.annotations = [];
      applyDashboardSpec({ scene: dashboard, spec, description: 'Apply schema', scope: 'code-pane' });
      const schemaBody = dashboard.state.body;
      const schemaTimeRange = dashboard.state.$timeRange;
      dashboard.setState({ editview: settings });
      const closeSettings = settings.activate();
      settings.onTitleChange('Settings title');
      settings.onTimeZoneChange('Europe/Paris');
      closeSettings();
      dashboard.setState({ editview: undefined });
      const sidebar = dashboard.state.sidebar;

      sidebar.undoAction();

      expect(dashboard.state.title).toBe('Schema title');
      expect(dashboard.state.$timeRange?.state.timeZone).toBe('UTC');
      expect(dashboard.state.body).toBe(schemaBody);
      expect(dashboard.state.$timeRange).toBe(schemaTimeRange);

      sidebar.undoAction();

      expect(dashboard.state.title).toBe('B');
      expect(dashboard.state.body).toBe(originalBody);

      sidebar.redoAction();

      expect(dashboard.state.title).toBe('Schema title');
      expect(dashboard.state.$timeRange?.state.timeZone).toBe('UTC');
      expect(dashboard.state.body).toBe(schemaBody);

      sidebar.redoAction();

      expect(dashboard.state.title).toBe('Settings title');
      expect(dashboard.state.$timeRange?.state.timeZone).toBe('Europe/Paris');
      expect(dashboard.state.$timeRange).toBe(schemaTimeRange);
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
