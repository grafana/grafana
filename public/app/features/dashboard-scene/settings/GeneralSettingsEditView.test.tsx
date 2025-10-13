import { behaviors, SceneTimeRange } from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';

import * as utils from '../pages/utils';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardScene } from '../scene/DashboardScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { GeneralSettingsEditView } from './GeneralSettingsEditView';

describe('GeneralSettingsEditView', () => {
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
});

async function buildTestScene() {
  const settings = new GeneralSettingsEditView({});
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({}),
    $behaviors: [new behaviors.CursorSync({ sync: DashboardCursorSync.Off })],
    controls: new DashboardControls({}),
    title: 'hello',
    uid: 'dash-1',
    meta: {
      canEdit: true,
    },
    editview: settings,
  });

  activateFullSceneTree(dashboard);

  await new Promise((r) => setTimeout(r, 1));

  dashboard.onEnterEditMode();
  settings.activate();

  return { dashboard, settings };
}
