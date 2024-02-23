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
  SceneDataLayers,
  dataLayers,
} from '@grafana/scenes';
import { Dashboard } from '@grafana/schema';
import appEvents from 'app/core/app_events';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { VariablesChanged } from 'app/features/variables/types';

import { createWorker } from '../saving/createDetectChangesWorker';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { DecoratedRevisionModel } from '../settings/VersionsEditView';
import { historySrv } from '../settings/version-history/HistorySrv';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { djb2Hash } from '../utils/djb2Hash';

import { AlertStatesDataLayer } from './AlertStatesDataLayer';
import { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';
import { DashboardControls } from './DashboardControls';
import { DashboardScene, DashboardSceneState } from './DashboardScene';

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
        expect(scene.state.title).toBe('new name');
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
          body: new VizPanel({
            title: 'Panel B',
            key: 'panel-2',
            pluginId: 'table',
          }),
        }),
        new SceneGridItem({
          body: new VizPanel({
            title: 'Panel B',
            key: 'panel-2-clone-1',
            pluginId: 'table',
            $data: new SceneQueryRunner({ key: 'data-query-runner2', queries: [{ refId: 'A' }] }),
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
