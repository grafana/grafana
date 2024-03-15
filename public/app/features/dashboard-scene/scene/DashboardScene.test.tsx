import { CoreApp } from '@grafana/data';
import {
  sceneGraph,
  SceneGridItem,
  SceneGridLayout,
  SceneTimeRange,
  SceneQueryRunner,
  SceneVariableSet,
  TestVariable,
  VizPanel,
  SceneGridRow,
  behaviors,
} from '@grafana/scenes';
import { Dashboard, DashboardCursorSync } from '@grafana/schema';
import appEvents from 'app/core/app_events';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { VariablesChanged } from 'app/features/variables/types';

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

import { DashboardControls } from './DashboardControls';
import { DashboardScene, DashboardSceneState } from './DashboardScene';
import { LibraryVizPanel } from './LibraryVizPanel';
import { PanelRepeaterGridItem } from './PanelRepeaterGridItem';

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
        const gridItem = sceneGraph.findObject(scene, (p) => p.state.key === 'griditem-1') as SceneGridItem;
        gridItem.setState({ x: 10, y: 0, width: 10, height: 10 });

        expect(scene.state.isDirty).toBe(true);

        scene.exitEditMode({ skipConfirm: true });
        const gridItem2 = sceneGraph.findObject(scene, (p) => p.state.key === 'griditem-1') as SceneGridItem;
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

      it.each`
        prop             | value
        ${'title'}       | ${'new title'}
        ${'description'} | ${'new description'}
        ${'tags'}        | ${['tag3', 'tag4']}
        ${'editable'}    | ${false}
        ${'links'}       | ${[]}
        ${'meta'}        | ${{ folderUid: 'new-folder-uid', folderTitle: 'new-folder-title', hasUnsavedFolderChange: true }}
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

      it('A change to refresh picker interval settings should set isDirty true', () => {
        const refreshPicker = dashboardSceneGraph.getRefreshPicker(scene)!;
        const prevState = [...refreshPicker.state.intervals!];
        refreshPicker.setState({ intervals: ['10s'] });

        expect(scene.state.isDirty).toBe(true);

        scene.exitEditMode({ skipConfirm: true });
        expect(dashboardSceneGraph.getRefreshPicker(scene)!.state.intervals).toEqual(prevState);
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
        const gridItem = body.state.children[0] as SceneGridItem;

        expect(body.state.children.length).toBe(6);
        expect(gridItem.state.body!.state.key).toBe('panel-5');
        expect(gridItem.state.y).toBe(0);
      });

      it('Should create and add a new panel to the dashboard', () => {
        scene.onCreateNewPanel();

        const body = scene.state.body as SceneGridLayout;
        const gridItem = body.state.children[0] as SceneGridItem;

        expect(body.state.children.length).toBe(6);
        expect(gridItem.state.body!.state.key).toBe('panel-7');
      });

      it('Should create and add a new row to the dashboard', () => {
        scene.onCreateNewRow();

        const body = scene.state.body as SceneGridLayout;
        const gridRow = body.state.children[0] as SceneGridRow;

        expect(body.state.children.length).toBe(4);
        expect(gridRow.state.key).toBe('panel-7');
        expect(gridRow.state.children[0].state.key).toBe('griditem-1');
        expect(gridRow.state.children[1].state.key).toBe('griditem-2');
      });

      it('Should create a row and add all panels in the dashboard under it', () => {
        const scene = buildTestScene({
          body: new SceneGridLayout({
            children: [
              new SceneGridItem({
                key: 'griditem-1',
                x: 0,
                body: new VizPanel({
                  title: 'Panel A',
                  key: 'panel-1',
                  pluginId: 'table',
                  $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
                }),
              }),
              new SceneGridItem({
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

        const vizPanel = (body.state.children[2] as SceneGridItem).state.body as VizPanel;

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

        expect(scene.state.hasCopiedPanel).toBe(false);
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

        expect(scene.state.hasCopiedPanel).toBe(false);
      });

      it('Should copy a panel', () => {
        const vizPanel = ((scene.state.body as SceneGridLayout).state.children[0] as SceneGridItem).state.body;
        scene.copyPanel(vizPanel as VizPanel);

        expect(scene.state.hasCopiedPanel).toBe(true);
      });

      it('Should copy a library viz panel', () => {
        const libVizPanel = ((scene.state.body as SceneGridLayout).state.children[4] as SceneGridItem).state
          .body as LibraryVizPanel;

        scene.copyPanel(libVizPanel.state.panel as VizPanel);

        expect(scene.state.hasCopiedPanel).toBe(true);
      });

      it('Should paste a panel', () => {
        scene.setState({ hasCopiedPanel: true });
        jest.spyOn(JSON, 'parse').mockReturnThis();
        jest.mocked(buildGridItemForPanel).mockReturnValue(
          new SceneGridItem({
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
        const gridItem = body.state.children[0] as SceneGridItem;

        expect(buildGridItemForPanel).toHaveBeenCalledTimes(1);
        expect(body.state.children.length).toBe(6);
        expect(gridItem.state.body!.state.key).toBe('panel-7');
        expect(gridItem.state.y).toBe(0);
        expect(scene.state.hasCopiedPanel).toBe(false);
      });

      it('Should paste a library viz panel', () => {
        scene.setState({ hasCopiedPanel: true });
        jest.spyOn(JSON, 'parse').mockReturnValue({ libraryPanel: { uid: 'uid', name: 'libraryPanel' } });
        jest.mocked(buildGridItemForLibPanel).mockReturnValue(
          new SceneGridItem({
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
        const gridItem = body.state.children[0] as SceneGridItem;

        const libVizPanel = gridItem.state.body as LibraryVizPanel;

        expect(buildGridItemForLibPanel).toHaveBeenCalledTimes(1);
        expect(body.state.children.length).toBe(6);
        expect(libVizPanel.state.panelKey).toBe('panel-7');
        expect(libVizPanel.state.panel?.state.key).toBe('panel-7');
        expect(gridItem.state.y).toBe(0);
        expect(scene.state.hasCopiedPanel).toBe(false);
      });

      it('Should create a new add library panel widget', () => {
        scene.onCreateLibPanelWidget();

        const body = scene.state.body as SceneGridLayout;
        const gridItem = body.state.children[0] as SceneGridItem;

        expect(body.state.children.length).toBe(6);
        expect(gridItem.state.body!.state.key).toBe('panel-7');
        expect(gridItem.state.y).toBe(0);
      });

      it('Should remove a panel', () => {
        const vizPanel = ((scene.state.body as SceneGridLayout).state.children[0] as SceneGridItem).state.body;
        scene.removePanel(vizPanel as VizPanel);

        const body = scene.state.body as SceneGridLayout;
        expect(body.state.children.length).toBe(4);
      });

      it('Should remove a panel within a row', () => {
        const vizPanel = (
          ((scene.state.body as SceneGridLayout).state.children[2] as SceneGridRow).state.children[0] as SceneGridItem
        ).state.body;
        scene.removePanel(vizPanel as VizPanel);

        const body = scene.state.body as SceneGridLayout;
        const gridRow = body.state.children[2] as SceneGridRow;
        expect(gridRow.state.children.length).toBe(1);
      });

      it('Should remove a library panel', () => {
        const libraryPanel = ((scene.state.body as SceneGridLayout).state.children[4] as SceneGridItem).state.body;
        const vizPanel = (libraryPanel as LibraryVizPanel).state.panel;
        scene.removePanel(vizPanel as VizPanel);

        const body = scene.state.body as SceneGridLayout;
        expect(body.state.children.length).toBe(4);
      });

      it('Should remove a library panel within a row', () => {
        const libraryPanel = (
          ((scene.state.body as SceneGridLayout).state.children[2] as SceneGridRow).state.children[1] as SceneGridItem
        ).state.body;
        const vizPanel = (libraryPanel as LibraryVizPanel).state.panel;

        scene.removePanel(vizPanel as VizPanel);

        const body = scene.state.body as SceneGridLayout;
        const gridRow = body.state.children[2] as SceneGridRow;
        expect(gridRow.state.children.length).toBe(1);
      });

      it('Should duplicate a panel', () => {
        const vizPanel = ((scene.state.body as SceneGridLayout).state.children[0] as SceneGridItem).state.body;
        scene.duplicatePanel(vizPanel as VizPanel);

        const body = scene.state.body as SceneGridLayout;
        const gridItem = body.state.children[5] as SceneGridItem;

        expect(body.state.children.length).toBe(6);
        expect(gridItem.state.body!.state.key).toBe('panel-7');
      });

      it('Should duplicate a library panel', () => {
        const libraryPanel = ((scene.state.body as SceneGridLayout).state.children[4] as SceneGridItem).state.body;
        const vizPanel = (libraryPanel as LibraryVizPanel).state.panel;
        scene.duplicatePanel(vizPanel as VizPanel);

        const body = scene.state.body as SceneGridLayout;
        const gridItem = body.state.children[5] as SceneGridItem;

        const libVizPanel = gridItem.state.body as LibraryVizPanel;

        expect(body.state.children.length).toBe(6);
        expect(libVizPanel.state.panelKey).toBe('panel-7');
        expect(libVizPanel.state.panel?.state.key).toBe('panel-7');
      });

      it('Should duplicate a repeated panel', () => {
        const scene = buildTestScene({
          body: new SceneGridLayout({
            children: [
              new PanelRepeaterGridItem({
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
                source: new VizPanel({
                  title: 'Library Panel',
                  key: 'panel-1',
                  pluginId: 'table',
                }),
                variableName: 'custom',
              }),
            ],
          }),
        });

        const vizPanel = ((scene.state.body as SceneGridLayout).state.children[0] as PanelRepeaterGridItem).state
          .repeatedPanels![0];

        scene.duplicatePanel(vizPanel as VizPanel);

        const body = scene.state.body as SceneGridLayout;
        const gridItem = body.state.children[1] as SceneGridItem;

        expect(body.state.children.length).toBe(2);
        expect(gridItem.state.body!.state.key).toBe('panel-2');
      });

      it('Should duplicate a panel in a row', () => {
        const vizPanel = (
          ((scene.state.body as SceneGridLayout).state.children[2] as SceneGridRow).state.children[0] as SceneGridItem
        ).state.body;
        scene.duplicatePanel(vizPanel as VizPanel);

        const body = scene.state.body as SceneGridLayout;
        const gridRow = body.state.children[2] as SceneGridRow;
        const gridItem = gridRow.state.children[2] as SceneGridItem;

        expect(gridRow.state.children.length).toBe(3);
        expect(gridItem.state.body!.state.key).toBe('panel-7');
      });

      it('Should duplicate a library panel in a row', () => {
        const libraryPanel = (
          ((scene.state.body as SceneGridLayout).state.children[2] as SceneGridRow).state.children[1] as SceneGridItem
        ).state.body;
        const vizPanel = (libraryPanel as LibraryVizPanel).state.panel;

        scene.duplicatePanel(vizPanel as VizPanel);

        const body = scene.state.body as SceneGridLayout;
        const gridRow = body.state.children[2] as SceneGridRow;
        const gridItem = gridRow.state.children[2] as SceneGridItem;

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
              new SceneGridItem({
                key: 'griditem-2',
                body: libPanel,
              }),
            ],
          }),
        });

        scene.unlinkLibraryPanel(libPanel);

        const body = scene.state.body as SceneGridLayout;
        const gridItem = body.state.children[0] as SceneGridItem;

        expect(body.state.children.length).toBe(1);
        expect(gridItem.state.body).toBeInstanceOf(VizPanel);
      });
    });
  });

  describe('Enriching data requests', () => {
    let scene: DashboardScene;

    beforeEach(() => {
      scene = buildTestScene();
      scene.onEnterEditMode();
    });

    it('Should add app, uid, panelId and panelPluginId', () => {
      const queryRunner = sceneGraph.findObject(scene, (o) => o.state.key === 'data-query-runner')!;
      expect(scene.enrichDataRequest(queryRunner)).toEqual({
        app: CoreApp.Dashboard,
        dashboardUID: 'dash-1',
        panelId: 1,
        panelPluginId: 'table',
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
    $behaviors: [new behaviors.CursorSync({})],
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          key: 'griditem-1',
          x: 0,
          body: new VizPanel({
            title: 'Panel A',
            key: 'panel-1',
            pluginId: 'table',
            $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
          }),
        }),
        new SceneGridItem({
          key: 'griditem-2',
          body: new VizPanel({
            title: 'Panel B',
            key: 'panel-2',
            pluginId: 'table',
          }),
        }),
        new SceneGridRow({
          key: 'panel-3',
          children: [
            new SceneGridItem({
              body: new VizPanel({
                title: 'Panel C',
                key: 'panel-4',
                pluginId: 'table',
              }),
            }),
            new SceneGridItem({
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
        new SceneGridItem({
          body: new VizPanel({
            title: 'Panel B',
            key: 'panel-2-clone-1',
            pluginId: 'table',
            $data: new SceneQueryRunner({ key: 'data-query-runner2', queries: [{ refId: 'A' }] }),
          }),
        }),
        new SceneGridItem({
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
