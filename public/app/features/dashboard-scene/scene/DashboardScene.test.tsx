import { CoreApp, LoadingState, getDefaultTimeRange, store } from '@grafana/data';
import { locationService } from '@grafana/runtime';
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
} from '@grafana/scenes';
import { Dashboard, DashboardCursorSync, LibraryPanel } from '@grafana/schema';
import appEvents from 'app/core/app_events';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { VariablesChanged } from 'app/features/variables/types';

import { PanelEditor, buildPanelEditScene } from '../panel-edit/PanelEditor';
import { createWorker } from '../saving/createDetectChangesWorker';
import {
  buildGridItemForLibPanel,
  buildGridItemForPanel,
  transformSaveModelToScene,
} from '../serialization/transformSaveModelToScene';
import { DecoratedRevisionModel } from '../settings/VersionsEditView';
import { historySrv } from '../settings/version-history/HistorySrv';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { djb2Hash } from '../utils/djb2Hash';
import { findVizPanelByKey } from '../utils/utils';

import { DashboardControls } from './DashboardControls';
import { DashboardGridItem } from './DashboardGridItem';
import { DashboardScene, DashboardSceneState } from './DashboardScene';
import { LibraryVizPanel } from './LibraryVizPanel';
import { PanelTimeRange } from './PanelTimeRange';
import { RowActions } from './row-actions/RowActions';

jest.mock('../settings/version-history/HistorySrv');
jest.mock('../serialization/transformSaveModelToScene');
jest.mock('../saving/getDashboardChangesFromScene', () => ({
  // It compares the initial and changed save models and returns the differences
  // By default we assume there are differences to have the dirty state test logic tested
  getDashboardChangesFromScene: jest.fn(() => ({
    changedSaveModel: {},
    initialSaveModel: {},
    diffs: [],
    diffCount: 0,
    hasChanges: true,
    hasTimeChanges: false,
    isNew: false,
    hasVariableValueChanges: false,
  })),
}));
jest.mock('../serialization/transformSceneToSaveModel');
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds1' }),
    };
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

const worker = createWorker();
mockResultsOfDetectChangesWorker({ hasChanges: true, hasTimeChanges: false, hasVariableValueChanges: false });

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

    describe('Given new dashboard in edit mode', () => {
      it('when saving it should clear isNew state', () => {
        const scene = buildTestScene({
          meta: { isNew: true },
        });

        scene.activate();
        scene.onEnterEditMode();
        scene.saveCompleted({} as Dashboard, {
          id: 1,
          slug: 'slug',
          uid: 'dash-1',
          url: 'sss',
          version: 2,
          status: 'aaa',
        });

        expect(scene.state.meta.isNew).toBeFalsy();
      });
    });

    describe('Given scene in edit mode', () => {
      let scene: DashboardScene;
      let deactivateScene: () => void;

      beforeEach(() => {
        scene = buildTestScene();
        deactivateScene = scene.activate();
        scene.onEnterEditMode();
        jest.clearAllMocks();
      });

      it('Should set isEditing to true', () => {
        expect(scene.state.isEditing).toBe(true);
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

      it('Should exit edit mode and discard panel changes if leaving the dashboard while in panel edit', () => {
        const panel = findVizPanelByKey(scene, 'panel-1');
        const editPanel = buildPanelEditScene(panel!);
        scene.setState({
          editPanel,
        });

        expect(scene.state.editPanel!['_discardChanges']).toBe(false);

        scene.exitEditMode({ skipConfirm: true });

        expect(scene.state.editPanel!['_discardChanges']).toBe(true);
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

        // The worker only detects changes in the model, so the folder change should be detected anyway
        mockResultsOfDetectChangesWorker({ hasChanges: false, hasTimeChanges: false, hasVariableValueChanges: false });

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

      it('A change to any LibraryVizPanel name should set isDirty true', () => {
        const libraryVizPanel = sceneGraph.findObject(scene, (p) => p instanceof LibraryVizPanel) as LibraryVizPanel;
        const prevValue = libraryVizPanel.state.name;

        libraryVizPanel.setState({ name: 'new name' });

        expect(scene.state.isDirty).toBe(true);

        scene.exitEditMode({ skipConfirm: true });
        const restoredLibraryVizPanel = sceneGraph.findObject(
          scene,
          (p) => p instanceof LibraryVizPanel
        ) as LibraryVizPanel;
        expect(restoredLibraryVizPanel.state.name).toBe(prevValue);
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

      it('Should throw an error when adding a panel to a layout that is not SceneGridLayout', () => {
        const scene = buildTestScene({ body: undefined });

        expect(() => {
          scene.addPanel(new VizPanel({ title: 'Panel Title', key: 'panel-4', pluginId: 'timeseries' }));
        }).toThrow('Trying to add a panel in a layout that is not SceneGridLayout');
      });

      it('Should add a new panel to the dashboard', () => {
        const vizPanel = new VizPanel({
          title: 'Panel Title',
          key: 'panel-5',
          pluginId: 'timeseries',
          $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
        });

        scene.addPanel(vizPanel);

        const body = scene.state.body as SceneGridLayout;
        const gridItem = body.state.children[0] as DashboardGridItem;

        expect(body.state.children.length).toBe(6);
        expect(gridItem.state.body!.state.key).toBe('panel-5');
        expect(gridItem.state.y).toBe(0);
      });

      it('Should create and add a new panel to the dashboard', () => {
        scene.exitEditMode({ skipConfirm: true });
        expect(scene.state.isEditing).toBe(false);

        scene.onCreateNewPanel();

        const body = scene.state.body as SceneGridLayout;
        const gridItem = body.state.children[0] as DashboardGridItem;

        expect(scene.state.isEditing).toBe(true);
        expect(body.state.children.length).toBe(6);
        expect(gridItem.state.body!.state.key).toBe('panel-7');
      });

      it('Should create and add a new row to the dashboard', () => {
        scene.onCreateNewRow();

        const body = scene.state.body as SceneGridLayout;
        const gridRow = body.state.children[0] as SceneGridRow;

        expect(scene.state.isEditing).toBe(true);
        expect(body.state.children.length).toBe(4);
        expect(gridRow.state.key).toBe('panel-7');
        expect(gridRow.state.children[0].state.key).toBe('griditem-1');
        expect(gridRow.state.children[1].state.key).toBe('griditem-2');
      });

      it('Should create a row and add all panels in the dashboard under it', () => {
        const scene = buildTestScene({
          body: new SceneGridLayout({
            children: [
              new DashboardGridItem({
                key: 'griditem-1',
                x: 0,
                body: new VizPanel({
                  title: 'Panel A',
                  key: 'panel-1',
                  pluginId: 'table',
                  $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
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
            ],
          }),
        });

        scene.onCreateNewRow();

        const body = scene.state.body as SceneGridLayout;
        const gridRow = body.state.children[0] as SceneGridRow;

        expect(body.state.children.length).toBe(1);
        expect(gridRow.state.children.length).toBe(2);
      });

      it('Should create and add two new rows, but the second has no children', () => {
        scene.onCreateNewRow();
        scene.onCreateNewRow();

        const body = scene.state.body as SceneGridLayout;
        const gridRow = body.state.children[0] as SceneGridRow;

        expect(body.state.children.length).toBe(5);
        expect(gridRow.state.children.length).toBe(0);
      });

      it('Should create an empty row when nothing else in dashboard', () => {
        const scene = buildTestScene({
          body: new SceneGridLayout({
            children: [],
          }),
        });

        scene.onCreateNewRow();

        const body = scene.state.body as SceneGridLayout;
        const gridRow = body.state.children[0] as SceneGridRow;

        expect(body.state.children.length).toBe(1);
        expect(gridRow.state.children.length).toBe(0);
      });

      it('Should remove a row and move its children to the grid layout', () => {
        const body = scene.state.body as SceneGridLayout;
        const row = body.state.children[2] as SceneGridRow;

        scene.removeRow(row);

        const vizPanel = (body.state.children[2] as DashboardGridItem).state.body as VizPanel;

        expect(body.state.children.length).toBe(6);
        expect(vizPanel.state.key).toBe('panel-4');
      });

      it('Should remove a row and its children', () => {
        const body = scene.state.body as SceneGridLayout;
        const row = body.state.children[2] as SceneGridRow;

        scene.removeRow(row, true);

        expect(body.state.children.length).toBe(4);
      });

      it('Should remove an empty row from the layout', () => {
        const row = new SceneGridRow({
          key: 'panel-1',
        });

        const scene = buildTestScene({
          body: new SceneGridLayout({
            children: [row],
          }),
        });

        const body = scene.state.body as SceneGridLayout;

        expect(body.state.children.length).toBe(1);

        scene.removeRow(row);

        expect(body.state.children.length).toBe(0);
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
        const libVizPanel = new LibraryVizPanel({
          uid: 'uid',
          name: 'libraryPanel',
          panelKey: 'panel-4',
          title: 'Library Panel',
          panel: new VizPanel({
            title: 'Library Panel',
            key: 'panel-4',
            pluginId: 'table',
          }),
        });

        scene.copyPanel(libVizPanel.state.panel as VizPanel);

        expect(store.exists(LS_PANEL_COPY_KEY)).toBe(false);
      });

      it('Should copy a panel', () => {
        const vizPanel = ((scene.state.body as SceneGridLayout).state.children[0] as DashboardGridItem).state.body;
        scene.copyPanel(vizPanel as VizPanel);

        expect(store.exists(LS_PANEL_COPY_KEY)).toBe(true);
      });

      it('Should copy a library viz panel', () => {
        const libVizPanel = ((scene.state.body as SceneGridLayout).state.children[4] as DashboardGridItem).state
          .body as LibraryVizPanel;

        scene.copyPanel(libVizPanel.state.panel as VizPanel);

        expect(store.exists(LS_PANEL_COPY_KEY)).toBe(true);
      });

      it('Should paste a panel', () => {
        store.set(LS_PANEL_COPY_KEY, JSON.stringify({ key: 'panel-7' }));
        jest.spyOn(JSON, 'parse').mockReturnThis();
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

        const body = scene.state.body as SceneGridLayout;
        const gridItem = body.state.children[0] as DashboardGridItem;

        expect(buildGridItemForPanel).toHaveBeenCalledTimes(1);
        expect(body.state.children.length).toBe(6);
        expect(gridItem.state.body!.state.key).toBe('panel-7');
        expect(gridItem.state.y).toBe(0);
        expect(store.exists(LS_PANEL_COPY_KEY)).toBe(false);
      });

      it('Should paste a library viz panel', () => {
        store.set(LS_PANEL_COPY_KEY, JSON.stringify({ key: 'panel-7' }));
        jest.spyOn(JSON, 'parse').mockReturnValue({ libraryPanel: { uid: 'uid', name: 'libraryPanel' } });
        jest.mocked(buildGridItemForLibPanel).mockReturnValue(
          new DashboardGridItem({
            body: new LibraryVizPanel({
              title: 'Library Panel',
              uid: 'uid',
              name: 'libraryPanel',
              panelKey: 'panel-4',
            }),
          })
        );

        scene.pastePanel();

        const body = scene.state.body as SceneGridLayout;
        const gridItem = body.state.children[0] as DashboardGridItem;

        const libVizPanel = gridItem.state.body as LibraryVizPanel;

        expect(buildGridItemForLibPanel).toHaveBeenCalledTimes(1);
        expect(body.state.children.length).toBe(6);
        expect(libVizPanel.state.panelKey).toBe('panel-7');
        expect(libVizPanel.state.panel?.state.key).toBe('panel-7');
        expect(gridItem.state.y).toBe(0);
        expect(store.exists(LS_PANEL_COPY_KEY)).toBe(false);
      });

      it('Should remove a panel', () => {
        const vizPanel = ((scene.state.body as SceneGridLayout).state.children[0] as DashboardGridItem).state.body;
        scene.removePanel(vizPanel as VizPanel);

        const body = scene.state.body as SceneGridLayout;
        expect(body.state.children.length).toBe(4);
      });

      it('Should remove a panel within a row', () => {
        const vizPanel = (
          ((scene.state.body as SceneGridLayout).state.children[2] as SceneGridRow).state
            .children[0] as DashboardGridItem
        ).state.body;
        scene.removePanel(vizPanel as VizPanel);

        const body = scene.state.body as SceneGridLayout;
        const gridRow = body.state.children[2] as SceneGridRow;

        expect(gridRow.state.children.length).toBe(1);
      });

      it('Should remove a library panel', () => {
        const libraryPanel = ((scene.state.body as SceneGridLayout).state.children[4] as DashboardGridItem).state.body;
        const vizPanel = (libraryPanel as LibraryVizPanel).state.panel;
        scene.removePanel(vizPanel as VizPanel);

        const body = scene.state.body as SceneGridLayout;
        expect(body.state.children.length).toBe(4);
      });

      it('Should remove a library panel within a row', () => {
        const libraryPanel = (
          ((scene.state.body as SceneGridLayout).state.children[2] as SceneGridRow).state
            .children[1] as DashboardGridItem
        ).state.body;
        const vizPanel = (libraryPanel as LibraryVizPanel).state.panel;

        scene.removePanel(vizPanel as VizPanel);

        const body = scene.state.body as SceneGridLayout;
        const gridRow = body.state.children[2] as SceneGridRow;
        expect(gridRow.state.children.length).toBe(1);
      });

      it('Should duplicate a panel', () => {
        const vizPanel = ((scene.state.body as SceneGridLayout).state.children[0] as DashboardGridItem).state.body;
        scene.duplicatePanel(vizPanel as VizPanel);

        const body = scene.state.body as SceneGridLayout;
        const gridItem = body.state.children[5] as DashboardGridItem;

        expect(body.state.children.length).toBe(6);
        expect(gridItem.state.body!.state.key).toBe('panel-7');
      });

      it('Should maintain size of duplicated panel', () => {
        const gItem = (scene.state.body as SceneGridLayout).state.children[0] as DashboardGridItem;
        gItem.setState({ height: 1 });
        const vizPanel = gItem.state.body;
        scene.duplicatePanel(vizPanel as VizPanel);

        const body = scene.state.body as SceneGridLayout;
        const newGridItem = body.state.children[5] as DashboardGridItem;

        expect(body.state.children.length).toBe(6);
        expect(newGridItem.state.body!.state.key).toBe('panel-7');
        expect(newGridItem.state.height).toBe(1);
      });

      it('Should duplicate a library panel', () => {
        const libraryPanel = ((scene.state.body as SceneGridLayout).state.children[4] as DashboardGridItem).state.body;
        const vizPanel = (libraryPanel as LibraryVizPanel).state.panel;
        scene.duplicatePanel(vizPanel as VizPanel);

        const body = scene.state.body as SceneGridLayout;
        const gridItem = body.state.children[5] as DashboardGridItem;

        const libVizPanel = gridItem.state.body as LibraryVizPanel;

        expect(body.state.children.length).toBe(6);
        expect(libVizPanel.state.panelKey).toBe('panel-7');
        expect(libVizPanel.state.panel?.state.key).toBe('panel-7');
      });

      it('Should duplicate a repeated panel', () => {
        const scene = buildTestScene({
          body: new SceneGridLayout({
            children: [
              new DashboardGridItem({
                key: `grid-item-1`,
                width: 24,
                height: 8,
                repeatedPanels: [
                  new VizPanel({
                    title: 'Library Panel',
                    key: 'panel-1',
                    pluginId: 'table',
                  }),
                ],
                body: new VizPanel({
                  title: 'Library Panel',
                  key: 'panel-1',
                  pluginId: 'table',
                }),
                variableName: 'custom',
              }),
            ],
          }),
        });

        const vizPanel = ((scene.state.body as SceneGridLayout).state.children[0] as DashboardGridItem).state
          .repeatedPanels![0];

        scene.duplicatePanel(vizPanel as VizPanel);

        const body = scene.state.body as SceneGridLayout;
        const gridItem = body.state.children[1] as DashboardGridItem;

        expect(body.state.children.length).toBe(2);
        expect(gridItem.state.body!.state.key).toBe('panel-2');
      });

      it('Should duplicate a panel in a row', () => {
        const vizPanel = (
          ((scene.state.body as SceneGridLayout).state.children[2] as SceneGridRow).state
            .children[0] as DashboardGridItem
        ).state.body;
        scene.duplicatePanel(vizPanel as VizPanel);

        const body = scene.state.body as SceneGridLayout;
        const gridRow = body.state.children[2] as SceneGridRow;
        const gridItem = gridRow.state.children[2] as DashboardGridItem;

        expect(gridRow.state.children.length).toBe(3);
        expect(gridItem.state.body!.state.key).toBe('panel-7');
      });

      it('Should duplicate a library panel in a row', () => {
        const libraryPanel = (
          ((scene.state.body as SceneGridLayout).state.children[2] as SceneGridRow).state
            .children[1] as DashboardGridItem
        ).state.body;
        const vizPanel = (libraryPanel as LibraryVizPanel).state.panel;

        scene.duplicatePanel(vizPanel as VizPanel);

        const body = scene.state.body as SceneGridLayout;
        const gridRow = body.state.children[2] as SceneGridRow;
        const gridItem = gridRow.state.children[2] as DashboardGridItem;

        const libVizPanel = gridItem.state.body as LibraryVizPanel;

        expect(gridRow.state.children.length).toBe(3);
        expect(libVizPanel.state.panelKey).toBe('panel-7');
        expect(libVizPanel.state.panel?.state.key).toBe('panel-7');
      });

      it('Should fail to duplicate a panel if it does not have a grid item parent', () => {
        const vizPanel = new VizPanel({
          title: 'Panel Title',
          key: 'panel-5',
          pluginId: 'timeseries',
        });

        scene.duplicatePanel(vizPanel);

        const body = scene.state.body as SceneGridLayout;

        // length remains unchanged
        expect(body.state.children.length).toBe(5);
      });

      it('Should unlink a library panel', () => {
        const libPanel = new LibraryVizPanel({
          title: 'title',
          uid: 'abc',
          name: 'lib panel',
          panelKey: 'panel-1',
          isLoaded: true,
          panel: new VizPanel({
            title: 'Panel B',
            pluginId: 'table',
          }),
        });

        const scene = buildTestScene({
          body: new SceneGridLayout({
            children: [
              new DashboardGridItem({
                key: 'griditem-2',
                body: libPanel,
              }),
            ],
          }),
        });

        scene.unlinkLibraryPanel(libPanel);

        const body = scene.state.body as SceneGridLayout;
        const gridItem = body.state.children[0] as DashboardGridItem;

        expect(body.state.children.length).toBe(1);
        expect(gridItem.state.body).toBeInstanceOf(VizPanel);
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

        const scene = buildTestScene({
          body: new SceneGridLayout({
            children: [gridItem],
          }),
        });

        const libPanel = {
          uid: 'uid',
          name: 'name',
        };

        scene.createLibraryPanel(vizPanel, libPanel as LibraryPanel);

        const layout = scene.state.body as SceneGridLayout;
        const newGridItem = layout.state.children[0] as DashboardGridItem;

        expect(layout.state.children.length).toBe(1);
        expect(newGridItem.state.body).toBeInstanceOf(LibraryVizPanel);
        expect((newGridItem.state.body as LibraryVizPanel).state.uid).toBe('uid');
        expect((newGridItem.state.body as LibraryVizPanel).state.name).toBe('name');
      });

      it('Should create a library panel under a row', () => {
        const vizPanel = new VizPanel({
          title: 'Panel A',
          key: 'panel-1',
          pluginId: 'table',
        });

        const gridItem = new DashboardGridItem({
          key: 'griditem-1',
          body: vizPanel,
        });

        const scene = buildTestScene({
          body: new SceneGridLayout({
            children: [
              new SceneGridRow({
                key: 'row-1',
                children: [gridItem],
              }),
            ],
          }),
        });

        const libPanel = {
          uid: 'uid',
          name: 'name',
        };

        scene.createLibraryPanel(vizPanel, libPanel as LibraryPanel);

        const layout = scene.state.body as SceneGridLayout;
        const newGridItem = (layout.state.children[0] as SceneGridRow).state.children[0] as DashboardGridItem;

        expect(layout.state.children.length).toBe(1);
        expect((layout.state.children[0] as SceneGridRow).state.children.length).toBe(1);
        expect(newGridItem.state.body).toBeInstanceOf(LibraryVizPanel);
        expect((newGridItem.state.body as LibraryVizPanel).state.uid).toBe('uid');
        expect((newGridItem.state.body as LibraryVizPanel).state.name).toBe('name');
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
          panelId: 1,
          panelPluginId: 'table',
        });
      });
      test('when editing', () => {
        const panel = findVizPanelByKey(scene, 'panel-1');
        const editPanel = buildPanelEditScene(panel!);
        scene.setState({
          editPanel,
        });

        const queryRunner = (scene.state.editPanel as PanelEditor).state.vizManager.queryRunner;
        expect(scene.enrichDataRequest(queryRunner)).toEqual({
          app: CoreApp.Dashboard,
          dashboardUID: 'dash-1',
          panelId: 1,
          panelPluginId: 'table',
        });
      });
    });

    it('Should hash the key of the cloned panels and set it as panelId', () => {
      const queryRunner = sceneGraph.findObject(scene, (o) => o.state.key === 'data-query-runner2')!;
      const expectedPanelId = djb2Hash('panel-2-clone-1');
      expect(scene.enrichDataRequest(queryRunner).panelId).toEqual(expectedPanelId);
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
      mockResultsOfDetectChangesWorker({ hasChanges: true, hasTimeChanges: false, hasVariableValueChanges: true });
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

      mockResultsOfDetectChangesWorker({ hasChanges: true, hasTimeChanges: false, hasVariableValueChanges: false });
      variable.setState({ name: 'B' });
      expect(scene.state.isDirty).toBe(true);
      mockResultsOfDetectChangesWorker(
        // No changes, it is the same name than before comparing saving models
        { hasChanges: false, hasTimeChanges: false, hasVariableValueChanges: false }
      );
      variable.setState({ name: 'A' });
      expect(scene.state.isDirty).toBe(false);
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

  describe('When coming from explore', () => {
    // When coming from Explore the first panel in a dashboard is a temporary panel
    it('should remove first panel from the grid when discarding changes', () => {
      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        description: 'hello description',
        editable: true,
        $timeRange: new SceneTimeRange({
          timeZone: 'browser',
        }),
        controls: new DashboardControls({}),
        $behaviors: [new behaviors.CursorSync({})],
        body: new SceneGridLayout({
          children: [
            new DashboardGridItem({
              key: 'griditem-1',
              x: 0,
              body: new VizPanel({
                title: 'Panel A',
                key: 'panel-1',
                pluginId: 'table',
                $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
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
          ],
        }),
      });

      scene.onEnterEditMode(true);
      expect(scene.state.isEditing).toBe(true);
      expect((scene.state.body as SceneGridLayout).state.children.length).toBe(2);

      scene.exitEditMode({ skipConfirm: true });
      expect(scene.state.isEditing).toBe(false);
      expect((scene.state.body as SceneGridLayout).state.children.length).toBe(1);
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
    body: new SceneGridLayout({
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
              body: new LibraryVizPanel({
                uid: 'uid',
                name: 'libraryPanel',
                panelKey: 'panel-5',
                title: 'Library Panel',
                panel: new VizPanel({
                  title: 'Library Panel',
                  key: 'panel-5',
                  pluginId: 'table',
                }),
              }),
            }),
          ],
        }),
        new DashboardGridItem({
          body: new VizPanel({
            title: 'Panel B',
            key: 'panel-2-clone-1',
            pluginId: 'table',
            $data: new SceneQueryRunner({ key: 'data-query-runner2', queries: [{ refId: 'A' }] }),
          }),
        }),
        new DashboardGridItem({
          body: new LibraryVizPanel({
            uid: 'uid',
            name: 'libraryPanel',
            panelKey: 'panel-6',
            title: 'Library Panel',
            panel: new VizPanel({
              title: 'Library Panel',
              key: 'panel-6',
              pluginId: 'table',
            }),
          }),
        }),
      ],
    }),
    ...overrides,
  });

  return scene;
}

function mockResultsOfDetectChangesWorker({
  hasChanges,
  hasTimeChanges,
  hasVariableValueChanges,
}: {
  hasChanges: boolean;
  hasTimeChanges: boolean;
  hasVariableValueChanges: boolean;
}) {
  jest.mocked(worker.postMessage).mockImplementationOnce(() => {
    worker.onmessage?.({
      data: {
        hasChanges: hasChanges ?? true,
        hasTimeChanges: hasTimeChanges ?? true,
        hasVariableValueChanges: hasVariableValueChanges ?? true,
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
