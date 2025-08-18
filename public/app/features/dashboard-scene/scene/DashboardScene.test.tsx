import { CoreApp, GrafanaConfig, LoadingState, getDefaultTimeRange, locationUtil, store } from '@grafana/data';
import { config, locationService, RefreshEvent } from '@grafana/runtime';
import {
  sceneGraph,
  SceneGridLayout,
  SceneTimeRange,
  SceneQueryRunner,
  SceneVariableSet,
  TestVariable,
  VizPanel,
  SceneGridRow,
  behaviors,
  SceneDataTransformer,
  LocalValueVariable,
} from '@grafana/scenes';
import { Dashboard, DashboardCursorSync, LibraryPanel } from '@grafana/schema';
import appEvents from 'app/core/app_events';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import { AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { VariablesChanged } from 'app/features/variables/types';

import { buildPanelEditScene } from '../panel-edit/PanelEditor';
import { createWorker } from '../saving/createDetectChangesWorker';
import { buildGridItemForPanel, transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { DecoratedRevisionModel } from '../settings/VersionsEditView';
import { historySrv } from '../settings/version-history/HistorySrv';
import { getCloneKey } from '../utils/clone';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { findVizPanelByKey, getLibraryPanelBehavior, isLibraryPanel } from '../utils/utils';

import { DashboardControls } from './DashboardControls';
import { DashboardScene, DashboardSceneState } from './DashboardScene';
import { LibraryPanelBehavior } from './LibraryPanelBehavior';
import { PanelTimeRange } from './PanelTimeRange';
import { DashboardGridItem } from './layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { RowActions } from './layout-default/row-actions/RowActions';

jest.mock('../settings/version-history/HistorySrv');
jest.mock('../serialization/transformSaveModelToScene');
jest.mock('../serialization/transformSceneToSaveModel');
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds1' }),
    };
  },
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    panels: {
      'briangann-datatable-panel': {
        id: 'briangann-datatable-panel',
        state: 'deprecated',
        angular: { detected: true, hideDeprecation: false },
      },
    },
  },
}));

jest.mock('app/features/playlist/PlaylistSrv', () => ({
  ...jest.requireActual('app/features/playlist/PlaylistSrv'),
  playlistSrv: {
    isPlaying: false,
    next: jest.fn(),
    prev: jest.fn(),
    stop: jest.fn(),
  },
}));

jest.mock('app/features/manage-dashboards/state/actions', () => ({
  ...jest.requireActual('app/features/manage-dashboards/state/actions'),
  deleteDashboard: jest.fn().mockResolvedValue({}),
}));

locationUtil.initialize({
  config: { appSubUrl: '/subUrl' } as GrafanaConfig,
  getVariablesUrlParams: jest.fn(),
  getTimeRangeForUrl: jest.fn(),
});

const worker = createWorker();
mockResultsOfDetectChangesWorker({ hasChanges: true });

describe('DashboardScene', () => {
  describe('DashboardSrv.getCurrent compatibility', () => {
    it('Should set to compatibility wrapper', () => {
      const scene = buildTestScene();
      scene.activate();

      expect(getDashboardSrv().getCurrent()?.uid).toBe('dash-1');
    });
  });

  describe('Editing and discarding', () => {
    describe('Given scene in view mode', () => {
      it('Should set isEditing to false', () => {
        const scene = buildTestScene();
        scene.activate();

        expect(scene.state.isEditing).toBeFalsy();
      });

      it('Should not start the detect changes worker', () => {
        const scene = buildTestScene();
        scene.activate();

        // @ts-expect-error it is a private property
        expect(scene._changesWorker).toBeUndefined();
      });
    });

    describe('Given scene in edit mode', () => {
      let scene: DashboardScene;
      let deactivateScene: () => void;

      beforeEach(() => {
        scene = buildTestScene();
        locationService.push('/d/dash-1');
        deactivateScene = scene.activate();
        scene.onEnterEditMode();
        jest.clearAllMocks();
      });

      it('Should set isEditing to true', () => {
        expect(scene.state.isEditing).toBe(true);
      });

      it('Can exit edit mode', () => {
        scene.exitEditMode({ skipConfirm: true });
        expect(locationService.getLocation().pathname).toBe('/d/dash-1');
      });

      it('Exiting already saved dashboard should not restore initial state', () => {
        scene.setState({ title: 'Updated title' });
        expect(scene.state.isDirty).toBe(true);

        scene.saveCompleted({} as Dashboard, {
          id: 1,
          slug: 'slug',
          uid: 'dash-1',
          url: 'sss',
          version: 2,
          status: 'aaa',
        });

        expect(scene.state.isDirty).toBe(false);
        scene.exitEditMode({ skipConfirm: true });
        expect(scene.state.title).toEqual('Updated title');
        expect(scene.state.meta.version).toEqual(2);
      });

      it('Should start the detect changes worker', () => {
        expect(worker.onmessage).toBeDefined();
      });

      it('Should terminate the detect changes worker when deactivate', () => {
        expect(worker.terminate).toHaveBeenCalledTimes(0);
        deactivateScene();
        expect(worker.terminate).toHaveBeenCalledTimes(1);
      });

      it('A change to griditem pos should set isDirty true', () => {
        const gridItem = sceneGraph.findObject(scene, (p) => p.state.key === 'griditem-1') as DashboardGridItem;
        gridItem.setState({ x: 10, y: 0, width: 10, height: 10 });

        expect(scene.state.isDirty).toBe(true);

        scene.exitEditMode({ skipConfirm: true });
        const gridItem2 = sceneGraph.findObject(scene, (p) => p.state.key === 'griditem-1') as DashboardGridItem;
        expect(gridItem2.state.x).toBe(0);
      });

      it('A change to gridlayout children order should set isDirty true', () => {
        const layout = sceneGraph.findObject(scene, (p) => p instanceof SceneGridLayout) as SceneGridLayout;
        const originalPanelOrder = layout.state.children.map((c) => c.state.key);

        // Change the order of the children. This happen when panels move around, then the children are re-ordered
        layout.setState({
          children: [layout.state.children[1], layout.state.children[0], layout.state.children[2]],
        });

        expect(scene.state.isDirty).toBe(true);

        scene.exitEditMode({ skipConfirm: true });
        const resoredLayout = sceneGraph.findObject(scene, (p) => p instanceof SceneGridLayout) as SceneGridLayout;
        expect(resoredLayout.state.children.map((c) => c.state.key)).toEqual(originalPanelOrder);
      });

      it('Should exit edit mode and discard panel changes if leaving the dashboard while in panel edit', async () => {
        const panel = findVizPanelByKey(scene, 'panel-1')!;
        const editPanel = buildPanelEditScene(panel!);
        scene.setState({ editPanel });

        panel.setState({ title: 'new title' });
        scene.exitEditMode({ skipConfirm: true });

        const discardPanel = findVizPanelByKey(scene, panel.state.key)!;
        expect(discardPanel.state.title).toBe('Panel A');
      });

      it.each`
        prop             | value
        ${'title'}       | ${'new title'}
        ${'description'} | ${'new description'}
        ${'tags'}        | ${['tag3', 'tag4']}
        ${'editable'}    | ${false}
        ${'links'}       | ${[]}
      `(
        'A change to $prop should set isDirty true',
        ({ prop, value }: { prop: keyof DashboardSceneState; value: unknown }) => {
          const prevState = scene.state[prop];
          scene.setState({ [prop]: value });

          expect(scene.state.isDirty).toBe(true);

          scene.exitEditMode({ skipConfirm: true });
          expect(scene.state[prop]).toEqual(prevState);
        }
      );

      it('A change to folderUid should set isDirty true', () => {
        const prevMeta = { ...scene.state.meta };

        // The worker detects changes in the model, so the folder change should be detected anyway
        mockResultsOfDetectChangesWorker({ hasChanges: false });

        scene.setState({
          meta: {
            ...prevMeta,
            folderUid: 'new-folder-uid',
            folderTitle: 'new-folder-title',
          },
        });

        expect(scene.state.isDirty).toBe(true);

        scene.exitEditMode({ skipConfirm: true });
        expect(scene.state.meta).toEqual(prevMeta);
      });

      it('A change to refresh picker interval settings should set isDirty true', () => {
        const refreshPicker = dashboardSceneGraph.getRefreshPicker(scene)!;
        const prevState = [...refreshPicker.state.intervals!];
        refreshPicker.setState({ intervals: ['10s'] });

        expect(scene.state.isDirty).toBe(true);

        scene.exitEditMode({ skipConfirm: true });
        expect(dashboardSceneGraph.getRefreshPicker(scene)!.state.intervals).toEqual(prevState);
      });

      it('A enabling/disabling live now setting should set isDirty true', () => {
        const liveNowTimer = scene.state.$behaviors?.find(
          (b) => b instanceof behaviors.LiveNowTimer
        ) as behaviors.LiveNowTimer;
        liveNowTimer.enable();

        expect(scene.state.isDirty).toBe(true);

        scene.exitEditMode({ skipConfirm: true });
        const restoredLiveNowTimer = scene.state.$behaviors?.find(
          (b) => b instanceof behaviors.LiveNowTimer
        ) as behaviors.LiveNowTimer;
        expect(restoredLiveNowTimer.state.enabled).toBeFalsy();
      });

      it('A change to time picker visibility settings should set isDirty true', () => {
        const dashboardControls = scene.state.controls!;
        const prevState = dashboardControls.state.hideTimeControls;
        dashboardControls.setState({ hideTimeControls: true });

        expect(scene.state.isDirty).toBe(true);

        scene.exitEditMode({ skipConfirm: true });
        expect(scene.state.controls!.state.hideTimeControls).toEqual(prevState);
      });

      it('A change to time zone should set isDirty true', () => {
        const timeRange = sceneGraph.getTimeRange(scene)!;
        const prevState = timeRange.state.timeZone;
        timeRange.setState({ timeZone: 'UTC' });

        expect(scene.state.isDirty).toBe(true);

        scene.exitEditMode({ skipConfirm: true });
        expect(sceneGraph.getTimeRange(scene)!.state.timeZone).toBe(prevState);
      });

      it('A change to a cursor sync config should set isDirty true', () => {
        const cursorSync = dashboardSceneGraph.getCursorSync(scene)!;
        const initialState = cursorSync.state;

        cursorSync.setState({
          sync: DashboardCursorSync.Tooltip,
        });

        expect(scene.state.isDirty).toBe(true);

        scene.exitEditMode({ skipConfirm: true });
        expect(dashboardSceneGraph.getCursorSync(scene)!.state).toEqual(initialState);
      });

      it('A change to a any VizPanel state should set isDirty true', () => {
        const panel = sceneGraph.findObject(scene, (p) => p instanceof VizPanel) as VizPanel;
        const prevTitle = panel.state.title;
        panel.setState({ title: 'new title' });

        expect(scene.state.isDirty).toBe(true);

        scene.exitEditMode({ skipConfirm: true });
        const restoredPanel = sceneGraph.findObject(scene, (p) => p instanceof VizPanel) as VizPanel;
        expect(restoredPanel.state.title).toBe(prevTitle);
      });

      it('A change to any DashboardGridItem state should set isDirty true', () => {
        const dashboardGridItem = sceneGraph.findObject(
          scene,
          (p) => p instanceof DashboardGridItem
        ) as DashboardGridItem;
        const prevValue = dashboardGridItem.state.variableName;

        dashboardGridItem.setState({ variableName: 'var1', repeatDirection: 'h', maxPerRow: 2 });

        expect(scene.state.isDirty).toBe(true);

        scene.exitEditMode({ skipConfirm: true });
        const restoredDashboardGridItem = sceneGraph.findObject(
          scene,
          (p) => p instanceof DashboardGridItem
        ) as DashboardGridItem;
        expect(restoredDashboardGridItem.state.variableName).toBe(prevValue);
      });

      it('A change to any library panel name should set isDirty true', () => {
        const panel = findVizPanelByKey(scene, 'panel-5')!;
        const behavior = getLibraryPanelBehavior(panel)!;
        const prevValue = behavior.state.name;

        behavior.setState({ name: 'new name' });

        expect(scene.state.isDirty).toBe(true);

        scene.exitEditMode({ skipConfirm: true });

        const restoredPanel = findVizPanelByKey(scene, 'panel-5')!;
        const restoredBehavior = getLibraryPanelBehavior(restoredPanel)!;
        expect(restoredBehavior.state.name).toBe(prevValue);
      });

      it('A change to any PanelTimeRange state should set isDirty true', () => {
        const panelTimeRange = sceneGraph.findObject(scene, (p) => p instanceof PanelTimeRange) as PanelTimeRange;
        const prevValue = panelTimeRange.state.from;

        panelTimeRange.setState({ from: 'now-1h', to: 'now' });

        expect(scene.state.isDirty).toBe(true);

        scene.exitEditMode({ skipConfirm: true });
        const restoredPanelTimeRange = sceneGraph.findObject(
          scene,
          (p) => p instanceof PanelTimeRange
        ) as PanelTimeRange;
        expect(restoredPanelTimeRange.state.from).toEqual(prevValue);
      });

      it('A change to any SceneQueryRunner state should set isDirty true', () => {
        const queryRunner = sceneGraph.findObject(scene, (p) => p instanceof SceneQueryRunner) as SceneQueryRunner;
        const prevValue = queryRunner.state.queries;

        queryRunner.setState({ queries: [{ refId: 'A', datasource: { uid: 'fake-uid', type: 'test' } }] });

        expect(scene.state.isDirty).toBe(true);

        scene.exitEditMode({ skipConfirm: true });
        const restoredQueryRunner = sceneGraph.findObject(
          scene,
          (p) => p instanceof SceneQueryRunner
        ) as SceneQueryRunner;
        expect(restoredQueryRunner.state.queries).toEqual(prevValue);
      });

      it('A change to any SceneDataTransformer state should set isDirty true', () => {
        const dataTransformer = sceneGraph.findObject(
          scene,
          (p) => p instanceof SceneDataTransformer
        ) as SceneDataTransformer;
        const prevValue = dataTransformer.state.transformations;

        dataTransformer.setState({ transformations: [{ id: 'fake-transformation', options: {} }] });

        expect(scene.state.isDirty).toBe(true);

        scene.exitEditMode({ skipConfirm: true });
        const restoredDataTransformer = sceneGraph.findObject(
          scene,
          (p) => p instanceof SceneDataTransformer
        ) as SceneDataTransformer;
        expect(restoredDataTransformer.state.transformations).toEqual(prevValue);
      });

      it('A change to any SceneDataTransformer data should NOT set isDirty true', () => {
        const dataTransformer = sceneGraph.findObject(
          scene,
          (p) => p instanceof SceneDataTransformer
        ) as SceneDataTransformer;
        const prevValue = dataTransformer.state.data;
        const newData = { state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [] };

        dataTransformer.setState({ data: newData });

        expect(scene.state.isDirty).toBeFalsy();

        scene.exitEditMode({ skipConfirm: true });

        const restoredDataTransformer = sceneGraph.findObject(
          scene,
          (p) => p instanceof SceneDataTransformer
        ) as SceneDataTransformer;
        expect(restoredDataTransformer.state.data).toEqual(prevValue);
      });

      it.each([
        { hasChanges: true, hasTimeChanges: false, hasVariableValueChanges: false },
        { hasChanges: true, hasTimeChanges: true, hasVariableValueChanges: false },
        { hasChanges: true, hasTimeChanges: false, hasVariableValueChanges: true },
      ])('should set the state to true if there are changes detected in the saving model', (diffResults) => {
        mockResultsOfDetectChangesWorker(diffResults);
        scene.setState({ title: 'hello' });
        expect(scene.state.isDirty).toBeTruthy();
      });

      it.each([
        { hasChanges: false, hasTimeChanges: false, hasVariableValueChanges: false },
        { hasChanges: false, hasTimeChanges: true, hasVariableValueChanges: false },
        { hasChanges: false, hasTimeChanges: false, hasVariableValueChanges: true },
      ])('should not set the state to true if there are no change detected in the dashboard', (diffResults) => {
        mockResultsOfDetectChangesWorker(diffResults);
        scene.setState({ title: 'hello' });
        expect(scene.state.isDirty).toBeFalsy();
      });

      it('Should create and add a new panel to the dashboard', () => {
        scene.exitEditMode({ skipConfirm: true });
        expect(scene.state.isEditing).toBe(false);

        const panel = scene.onCreateNewPanel();

        expect(scene.state.isEditing).toBe(true);
        expect(scene.state.body.getVizPanels().length).toBe(7);
        expect(panel.state.key).toBe('panel-7');
      });

      it('Should select new row', () => {
        scene.state.editPane.activate();

        const row = scene.onCreateNewRow();
        expect(scene.state.editPane.state.selection?.getFirstObject()).toBe(row);
      });

      it('Should fail to copy a panel if it does not have a grid item parent', () => {
        const vizPanel = new VizPanel({
          title: 'Panel Title',
          key: 'panel-5',
          pluginId: 'timeseries',
        });

        scene.copyPanel(vizPanel);

        expect(store.exists(LS_PANEL_COPY_KEY)).toBe(false);
      });

      it('Should fail to copy a library panel if it does not have a grid item parent', () => {
        const libVizPanel = new VizPanel({
          title: 'Library Panel',
          pluginId: 'table',
          key: 'panel-4',
          $behaviors: [new LibraryPanelBehavior({ name: 'libraryPanel', uid: 'uid' })],
        });

        scene.copyPanel(libVizPanel);

        expect(store.exists(LS_PANEL_COPY_KEY)).toBe(false);
      });

      it('Should copy a panel', () => {
        const vizPanel = findVizPanelByKey(scene, 'panel-1')!;
        scene.copyPanel(vizPanel as VizPanel);

        expect(store.exists(LS_PANEL_COPY_KEY)).toBe(true);
      });

      it('Should copy a library viz panel', () => {
        const libVizPanel = findVizPanelByKey(scene, 'panel-6')!;

        expect(isLibraryPanel(libVizPanel)).toBe(true);

        scene.copyPanel(libVizPanel);

        expect(store.exists(LS_PANEL_COPY_KEY)).toBe(true);
      });

      it('Should paste a panel', () => {
        store.set(LS_PANEL_COPY_KEY, JSON.stringify({ key: 'panel-7' }));
        jest.mocked(buildGridItemForPanel).mockReturnValue(
          new DashboardGridItem({
            key: 'griditem-9',
            body: new VizPanel({
              title: 'Panel A',
              key: 'panel-9',
              pluginId: 'table',
            }),
          })
        );

        scene.pastePanel();

        expect(buildGridItemForPanel).toHaveBeenCalledTimes(1);

        const addedPanel = findVizPanelByKey(scene, 'panel-7')!;
        expect(addedPanel).toBeDefined();
        expect(store.exists(LS_PANEL_COPY_KEY)).toBe(false);
      });

      it('Should paste a library viz panel', () => {
        store.set(LS_PANEL_COPY_KEY, JSON.stringify({ key: 'panel-7' }));
        jest.mocked(buildGridItemForPanel).mockReturnValue(
          new DashboardGridItem({
            body: new VizPanel({
              title: 'Library Panel',
              pluginId: 'table',
              key: 'panel-4',
              $behaviors: [new LibraryPanelBehavior({ name: 'libraryPanel', uid: 'uid' })],
            }),
          })
        );

        scene.pastePanel();

        expect(buildGridItemForPanel).toHaveBeenCalledTimes(1);

        const addedPanel = findVizPanelByKey(scene, 'panel-7')!;
        expect(addedPanel).toBeDefined();
        expect(addedPanel.state.key).toBe('panel-7');
        expect(store.exists(LS_PANEL_COPY_KEY)).toBe(false);
      });

      it('Should unlink a library panel', () => {
        const libPanel = new VizPanel({
          title: 'Panel B',
          pluginId: 'table',
          $behaviors: [new LibraryPanelBehavior({ name: 'lib panel', uid: 'abc', isLoaded: true })],
        });

        const scene = buildTestScene({
          body: DefaultGridLayoutManager.fromVizPanels([libPanel]),
        });

        expect(isLibraryPanel(libPanel)).toBe(true);

        scene.unlinkLibraryPanel(libPanel);

        expect(isLibraryPanel(libPanel)).toBe(false);
      });

      it('Should create a library panel', () => {
        const vizPanel = new VizPanel({
          title: 'Panel A',
          key: 'panel-1',
          pluginId: 'table',
        });

        const gridItem = new DashboardGridItem({
          key: 'griditem-1',
          body: vizPanel,
        });

        const grid = new SceneGridLayout({ children: [gridItem] });
        const scene = buildTestScene({
          body: new DefaultGridLayoutManager({ grid }),
        });

        const libPanel = {
          uid: 'uid',
          name: 'name',
        };

        scene.createLibraryPanel(vizPanel, libPanel as LibraryPanel);

        const newGridItem = grid.state.children[0] as DashboardGridItem;
        const behavior = newGridItem.state.body.state.$behaviors![0] as LibraryPanelBehavior;

        expect(grid.state.children.length).toBe(1);
        expect(newGridItem.state.body).toBeInstanceOf(VizPanel);
        expect(behavior.state.uid).toBe('uid');
        expect(behavior.state.name).toBe('name');
      });
    });
  });

  describe('Deleting dashboard', () => {
    it('Should mark it non dirty before navigating to root', async () => {
      const scene = buildTestScene();
      scene.setState({ isDirty: true });

      locationService.push('/d/adsdas');
      await scene.onDashboardDelete();

      expect(scene.state.isDirty).toBe(false);
    });
  });

  describe('Enriching data requests', () => {
    let scene: DashboardScene;

    beforeEach(() => {
      scene = buildTestScene();
      scene.onEnterEditMode();
    });

    describe('Should add app, uid, panelId and panelPluginId', () => {
      test('when viewing', () => {
        const queryRunner = sceneGraph.findObject(scene, (o) => o.state.key === 'data-query-runner')!;
        expect(scene.enrichDataRequest(queryRunner)).toEqual({
          app: CoreApp.Dashboard,
          dashboardUID: 'dash-1',
          dashboardTitle: 'hello',
          panelId: 1,
          panelName: 'Panel A',
          panelPluginId: 'table',
        });
      });

      test('when editing', () => {
        const panel = findVizPanelByKey(scene, 'panel-1');
        const editPanel = buildPanelEditScene(panel!);
        scene.setState({ editPanel });

        const queryRunner = editPanel.getPanel().state.$data!;

        expect(scene.enrichDataRequest(queryRunner)).toEqual({
          app: CoreApp.Dashboard,
          dashboardUID: 'dash-1',
          dashboardTitle: 'hello',
          panelId: 1,
          panelName: 'Panel A',
          panelPluginId: 'table',
        });
      });
    });

    it('Should hash the key of the cloned panels and set it as panelId', () => {
      const queryRunner = sceneGraph.findObject(scene, (o) => o.state.key === 'data-query-runner2')!;
      expect(scene.enrichDataRequest(queryRunner).panelId).toEqual(3670868617);
    });
  });

  describe('When variables change', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('A change to variable values should trigger VariablesChanged event', () => {
      const varA = new TestVariable({ name: 'A', query: 'A.*', value: 'A.AA', text: '', options: [], delayMs: 0 });
      const scene = buildTestScene({
        $variables: new SceneVariableSet({ variables: [varA] }),
      });

      scene.activate();

      const eventHandler = jest.fn();
      appEvents.subscribe(VariablesChanged, eventHandler);

      varA.changeValueTo('A.AB');

      expect(eventHandler).toHaveBeenCalledTimes(1);
    });

    it('A change to the variable set should set isDirty true', () => {
      const varA = new TestVariable({ name: 'A', query: 'A.*', value: 'A.AA', text: '', options: [], delayMs: 0 });
      const scene = buildTestScene({
        $variables: new SceneVariableSet({ variables: [varA] }),
      });

      scene.activate();
      scene.onEnterEditMode();

      const variableSet = sceneGraph.getVariables(scene);
      variableSet.setState({ variables: [] });

      expect(scene.state.isDirty).toBe(true);
    });

    it('A change to a variable state should set isDirty true', () => {
      mockResultsOfDetectChangesWorker({ hasChanges: true });
      const variable = new TestVariable({ name: 'A' });
      const scene = buildTestScene({
        $variables: new SceneVariableSet({ variables: [variable] }),
      });

      scene.activate();
      scene.onEnterEditMode();

      variable.setState({ name: 'new-name' });

      expect(variable.state.name).toBe('new-name');
      expect(scene.state.isDirty).toBe(true);
    });

    it('A change to variable name is restored to original name should set isDirty back to false', () => {
      const variable = new TestVariable({ name: 'A' });
      const scene = buildTestScene({
        $variables: new SceneVariableSet({ variables: [variable] }),
      });

      scene.activate();
      scene.onEnterEditMode();

      mockResultsOfDetectChangesWorker({ hasChanges: true });
      variable.setState({ name: 'B' });
      expect(scene.state.isDirty).toBe(true);
      mockResultsOfDetectChangesWorker({ hasChanges: false });
      variable.setState({ name: 'A' });
      expect(scene.state.isDirty).toBe(false);
    });

    it('should trigger scene RefreshEvent when a scene variable changes', () => {
      const varA = new TestVariable({ name: 'A', query: 'A.*', value: 'A.AA', text: '', options: [], delayMs: 0 });
      const scene = buildTestScene({
        $variables: new SceneVariableSet({ variables: [varA] }),
      });

      scene.activate();

      const eventHandler = jest.fn();
      // this RefreshEvent is from the scenes library
      scene.subscribeToEvent(RefreshEvent, eventHandler);
      varA.changeValueTo('A.AB');
      expect(eventHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('When a dashboard is restored', () => {
    let scene: DashboardScene;

    beforeEach(async () => {
      scene = buildTestScene();
      scene.onEnterEditMode();
    });

    it('should restore the dashboard to the selected version and exit edit mode', () => {
      const newVersion = 3;

      const mockScene = new DashboardScene({
        title: 'new name',
        uid: 'dash-1',
        version: 4,
      });

      jest.mocked(historySrv.restoreDashboard).mockResolvedValue({ version: newVersion });
      jest.mocked(transformSaveModelToScene).mockReturnValue(mockScene);

      return scene.onRestore(getVersionMock()).then((res) => {
        expect(res).toBe(true);

        expect(scene.state.version).toBe(newVersion);
        expect(scene.state.isEditing).toBe(false);
      });
    });

    it('should return early if historySrv does not return a valid version number', () => {
      jest
        .mocked(historySrv.restoreDashboard)
        .mockResolvedValueOnce({ version: null })
        .mockResolvedValueOnce({ version: undefined })
        .mockResolvedValueOnce({ version: Infinity })
        .mockResolvedValueOnce({ version: NaN })
        .mockResolvedValue({ version: '10' });

      for (let i = 0; i < 5; i++) {
        scene.onRestore(getVersionMock()).then((res) => {
          expect(res).toBe(false);
        });
      }
    });
  });

  describe('When checking dashboard managed by an external system', () => {
    beforeEach(() => {
      config.featureToggles.provisioning = true;
    });

    afterEach(() => {
      config.featureToggles.provisioning = false;
    });

    it('should return true if the dashboard is managed', () => {
      const scene = buildTestScene({
        meta: {
          k8s: {
            annotations: {
              [AnnoKeyManagerKind]: ManagerKind.Repo,
            },
          },
        },
      });
      expect(scene.isManaged()).toBe(true);
    });

    it('dashboard should be editable if managed by repo', () => {
      const scene = buildTestScene({
        meta: {
          k8s: {
            annotations: {
              [AnnoKeyManagerKind]: ManagerKind.Repo,
            },
          },
        },
      });
      expect(scene.managedResourceCannotBeEdited()).toBe(false);
    });

    it('dashboard should not be editable if managed by systems that do not allow edits: kubectl', () => {
      const scene = buildTestScene({
        meta: {
          k8s: {
            annotations: {
              [AnnoKeyManagerKind]: ManagerKind.Kubectl,
            },
          },
        },
      });
      expect(scene.managedResourceCannotBeEdited()).toBe(true);
    });

    it('dashboard should not be editable if managed by systems that do not allow edits: terraform', () => {
      const scene = buildTestScene({
        meta: {
          k8s: {
            annotations: {
              [AnnoKeyManagerKind]: ManagerKind.Terraform,
            },
          },
        },
      });
      expect(scene.managedResourceCannotBeEdited()).toBe(true);
    });

    it('dashboard should not be editable if managed by systems that do not allow edits: plugin', () => {
      const scene = buildTestScene({
        meta: {
          k8s: { annotations: { [AnnoKeyManagerKind]: ManagerKind.Plugin } },
        },
      });
      expect(scene.managedResourceCannotBeEdited()).toBe(true);
    });

    it('dashboard should be editable if not managed', () => {
      const scene = buildTestScene();
      expect(scene.managedResourceCannotBeEdited()).toBe(false);
    });
  });
});

function buildTestScene(overrides?: Partial<DashboardSceneState>) {
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    description: 'hello description',
    tags: ['tag1', 'tag2'],
    editable: true,
    $timeRange: new SceneTimeRange({
      timeZone: 'browser',
    }),
    controls: new DashboardControls({}),
    $behaviors: [new behaviors.CursorSync({}), new behaviors.LiveNowTimer({})],
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [
          new DashboardGridItem({
            key: 'griditem-1',
            x: 0,
            body: new VizPanel({
              title: 'Panel A',
              key: 'panel-1',
              pluginId: 'table',
              $timeRange: new PanelTimeRange({
                from: 'now-12h',
                to: 'now',
                timeZone: 'browser',
              }),
              $data: new SceneDataTransformer({
                transformations: [],
                $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
              }),
            }),
          }),
          new DashboardGridItem({
            key: 'griditem-2',
            body: new VizPanel({
              title: 'Panel B',
              key: 'panel-2',
              pluginId: 'table',
            }),
          }),
          new SceneGridRow({
            key: 'panel-3',
            actions: new RowActions({}),
            children: [
              new DashboardGridItem({
                body: new VizPanel({
                  title: 'Panel C',
                  key: 'panel-4',
                  pluginId: 'table',
                }),
              }),
              new DashboardGridItem({
                body: new VizPanel({
                  title: 'Library Panel',
                  pluginId: 'table',
                  key: 'panel-5',
                  $behaviors: [new LibraryPanelBehavior({ name: 'libraryPanel', uid: 'uid' })],
                }),
              }),
            ],
          }),
          new DashboardGridItem({
            body: new VizPanel({
              title: 'Panel B',
              key: getCloneKey('panel-2', 1),
              repeatSourceKey: 'panel-2',
              $variables: new SceneVariableSet({
                variables: [new LocalValueVariable({ name: 'a', value: 'A' })],
              }),
              pluginId: 'table',
              $data: new SceneQueryRunner({ key: 'data-query-runner2', queries: [{ refId: 'A' }] }),
            }),
          }),
          new DashboardGridItem({
            body: new VizPanel({
              title: 'Library Panel',
              pluginId: 'table',
              key: 'panel-6',
              $behaviors: [new LibraryPanelBehavior({ name: 'libraryPanel', uid: 'uid' })],
            }),
          }),
        ],
      }),
    }),
    ...overrides,
  });

  return scene;
}

function mockResultsOfDetectChangesWorker({ hasChanges = true }) {
  jest.mocked(worker.postMessage).mockImplementationOnce(() => {
    worker.onmessage?.({
      data: {
        hasChanges,
      },
    } as unknown as MessageEvent);
  });
}

function getVersionMock(): DecoratedRevisionModel {
  const dash: Dashboard = {
    title: 'new name',
    id: 5,
    schemaVersion: 30,
  };

  return {
    id: 2,
    checked: false,
    uid: 'uid',
    parentVersion: 1,
    version: 2,
    created: new Date(),
    createdBy: 'admin',
    message: '',
    data: dash,
    createdDateString: '2017-02-22 20:43:01',
    ageString: '7 years ago',
  };
}
