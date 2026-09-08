import { createMemoryHistory } from 'history';

import { HistoryWrapper, locationService, setLocationService } from '@grafana/runtime';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';

import { NotebookScene } from './NotebookScene';
import { NotebookSceneUrlSync } from './NotebookSceneUrlSync';
import { NotebookLayoutManager } from './layout-notebook/NotebookLayoutManager';

function buildScene() {
  return new NotebookScene({
    title: 'My notebook',
    body: new NotebookLayoutManager({ cells: [] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });
}

describe('NotebookSceneUrlSync', () => {
  const originalLocationService = locationService;

  beforeEach(() => {
    setLocationService(new HistoryWrapper(createMemoryHistory({ initialEntries: ['/notebooks/nb1'] })));
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  afterEach(() => {
    setLocationService(originalLocationService);
    jest.restoreAllMocks();
  });

  describe('getUrlState', () => {
    it('claims the edit key', () => {
      expect(new NotebookSceneUrlSync(buildScene()).getKeys()).toEqual(['edit']);
    });

    it('leaves no param behind in view mode', () => {
      // undefined rather than 'false': locationService.partial deletes the key, so a notebook being
      // read has a clean url instead of ?edit=false.
      expect(new NotebookSceneUrlSync(buildScene()).getUrlState()).toEqual({ edit: undefined });
    });

    it('reflects edit mode', () => {
      const scene = buildScene();
      scene.onEnterEditMode();

      expect(new NotebookSceneUrlSync(scene).getUrlState()).toEqual({ edit: 'true' });
    });
  });

  describe('updateFromUrl', () => {
    it('enters edit mode for edit=true', () => {
      const scene = buildScene();

      new NotebookSceneUrlSync(scene).updateFromUrl({ edit: 'true' });

      expect(scene.state.isEditing).toBe(true);
    });

    it('leaves edit mode when the param goes away', () => {
      // An absent param arrives as null, which is how back/forward and a pasted view link land here.
      const scene = buildScene();
      scene.onEnterEditMode();

      new NotebookSceneUrlSync(scene).updateFromUrl({ edit: null });

      expect(scene.state.isEditing).toBe(false);
    });

    it('treats an explicit edit=false as view mode', () => {
      const scene = buildScene();
      scene.onEnterEditMode();

      new NotebookSceneUrlSync(scene).updateFromUrl({ edit: 'false' });

      expect(scene.state.isEditing).toBe(false);
    });

    it('refuses edit=true for a user without permission', () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
      const scene = buildScene();

      new NotebookSceneUrlSync(scene).updateFromUrl({ edit: 'true' });

      expect(scene.state.isEditing).toBeFalsy();
    });

    it('clears the param it refused, so the url stops claiming a mode the notebook is not in', () => {
      // A refusal changes no state, so the sync manager would never write the url itself.
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
      locationService.push('/notebooks/nb1?edit=true');

      new NotebookSceneUrlSync(buildScene()).updateFromUrl({ edit: 'true' });

      expect(locationService.getLocation().search).not.toContain('edit');
    });
  });
});
