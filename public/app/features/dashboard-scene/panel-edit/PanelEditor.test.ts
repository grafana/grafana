import { of } from 'rxjs';

import { DataQueryRequest, DataSourceApi, LoadingState, PanelPlugin } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { setDataSourceSrv } from '@grafana/runtime';
import {
  CancelActivationHandler,
  CustomVariable,
  SceneDataTransformer,
  sceneGraph,
  SceneGridLayout,
  SceneQueryRunner,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';
import { mockDataSource, MockDataSourceSrv } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import * as libAPI from 'app/features/library-panels/state/api';

import { DashboardGridItem } from '../scene/DashboardGridItem';
import { DashboardScene } from '../scene/DashboardScene';
import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import { activateFullSceneTree } from '../utils/test-utils';
import { getQueryRunnerFor } from '../utils/utils';

import { buildPanelEditScene } from './PanelEditor';

const runRequestMock = jest.fn().mockImplementation((ds: DataSourceApi, request: DataQueryRequest) => {
  return of({
    state: LoadingState.Loading,
    series: [],
    timeRange: request.range,
  });
});

let pluginToLoad: PanelPlugin | undefined;
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getRunRequest: () => (ds: DataSourceApi, request: DataQueryRequest) => {
    return runRequestMock(ds, request);
  },
  getPluginImportUtils: () => ({
    getPanelPluginFromCache: jest.fn(() => pluginToLoad),
  }),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    panels: {
      text: {
        skipDataQuery: true,
      },
      timeseries: {
        skipDataQuery: false,
      },
    },
  },
}));

const dataSources = {
  ds1: mockDataSource({
    uid: 'ds1',
    type: DataSourceType.Prometheus,
  }),
};

setDataSourceSrv(new MockDataSourceSrv(dataSources));

let deactivate: CancelActivationHandler | undefined;

describe('PanelEditor', () => {
  afterEach(() => {
    if (deactivate) {
      deactivate();
      deactivate = undefined;
    }
  });

  describe('When discarding', () => {
    it('should discard changes revert all changes', () => {
      const { panelEditor, panel } = setup();

      panel.setState({ title: 'changed title' });
      panelEditor.onDiscard();

      expect(panel.state.title).toBe('original title');
    });

    it('should discard a newly added panel', () => {
      const { panelEditor, dashboard } = setup({ isNewPanel: true });
      panelEditor.onDiscard();

      expect((dashboard.state.body as SceneGridLayout).state.children.length).toBe(0);
    });

    it('should discard query runner changes', () => {
      const { panelEditor, panel } = setup({});

      const queryRunner = getQueryRunnerFor(panel);
      queryRunner?.setState({ maxDataPoints: 123, queries: [{ refId: 'A' }, { refId: 'B' }] });

      panelEditor.onDiscard();

      const restoredQueryRunner = getQueryRunnerFor(panel);
      expect(restoredQueryRunner?.state.maxDataPoints).toBe(500);
      expect(restoredQueryRunner?.state.queries.length).toBe(1);
    });
  });

  describe('When changes are made', () => {
    it('Should set state to dirty', () => {
      const { panelEditor, panel } = setup({});

      expect(panelEditor.state.isDirty).toBe(undefined);

      panel.setState({ title: 'changed title' });

      expect(panelEditor.state.isDirty).toBe(true);
    });

    it('Should reset dirty and orginal state when dashboard is saved', () => {
      const { panelEditor, panel } = setup({});

      expect(panelEditor.state.isDirty).toBe(undefined);

      panel.setState({ title: 'changed title' });

      panelEditor.dashboardSaved();

      expect(panelEditor.state.isDirty).toBe(false);

      panel.setState({ title: 'changed title 2' });

      expect(panelEditor.state.isDirty).toBe(true);

      // Change back to already saved state
      panel.setState({ title: 'changed title' });
      expect(panelEditor.state.isDirty).toBe(false);
    });
  });

  describe('When opening a repeated panel', () => {
    it('Should default to the first variable value if panel is repeated', async () => {
      const { panel } = setup({ repeatByVariable: 'server' });
      const variable = sceneGraph.lookupVariable('server', panel);
      expect(variable?.getValue()).toBe('A');
    });
  });

  describe('Handling library panels', () => {
    it('should call the api with the updated panel', async () => {
      pluginToLoad = getPanelPlugin({ id: 'text', skipDataQuery: true });

      const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });

      const libraryPanelModel = {
        title: 'title',
        uid: 'uid',
        name: 'libraryPanelName',
        model: vizPanelToPanel(panel),
        type: 'panel',
        version: 1,
      };

      const libPanelBehavior = new LibraryPanelBehavior({
        isLoaded: true,
        title: libraryPanelModel.title,
        uid: libraryPanelModel.uid,
        name: libraryPanelModel.name,
        _loadedPanel: libraryPanelModel,
      });

      panel.setState({ $behaviors: [libPanelBehavior] });

      const gridItem = new DashboardGridItem({ body: panel });
      const editScene = buildPanelEditScene(panel);
      const scene = new DashboardScene({
        editPanel: editScene,
        isEditing: true,
        body: new SceneGridLayout({
          children: [gridItem],
        }),
      });

      activateFullSceneTree(scene);

      panel.setState({ title: 'changed title' });
      libPanelBehavior.setState({ name: 'changed name' });

      jest.spyOn(libAPI, 'saveLibPanel').mockImplementation(async (panel) => {
        const updatedPanel = { ...libAPI.libraryVizPanelToSaveModel(panel), version: 2 };
        libPanelBehavior.setPanelFromLibPanel(updatedPanel);
      });

      editScene.onConfirmSaveLibraryPanel();

      await new Promise(process.nextTick); // Wait for mock api to return and update the library panel
      expect(libPanelBehavior.state._loadedPanel?.version).toBe(2);
      expect(libPanelBehavior.state.name).toBe('changed name');
      expect(libPanelBehavior.state.title).toBe('changed title');
      expect((gridItem.state.body as VizPanel).state.title).toBe('changed title');
    });

    it('unlinks library panel', () => {
      const libraryPanelModel = {
        title: 'title',
        uid: 'uid',
        name: 'libraryPanelName',
        model: {
          title: 'title',
          type: 'text',
        },
        type: 'panel',
        version: 1,
      };

      const libPanelBehavior = new LibraryPanelBehavior({
        isLoaded: true,
        title: libraryPanelModel.title,
        uid: libraryPanelModel.uid,
        name: libraryPanelModel.name,
        _loadedPanel: libraryPanelModel,
      });

      // Just adding an extra stateless behavior to verify unlinking does not remvoe it
      const otherBehavior = jest.fn();
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'text', $behaviors: [libPanelBehavior, otherBehavior] });
      const editScene = buildPanelEditScene(panel);
      editScene.onConfirmUnlinkLibraryPanel();

      expect(panel.state.$behaviors?.length).toBe(1);
      expect(panel.state.$behaviors![0]).toBe(otherBehavior);
    });
  });

  describe('PanelDataPane', () => {
    it('should not exist if panel is skipDataQuery', () => {
      const { panelEditor } = setup({ pluginSkipDataQuery: true });

      expect(panelEditor.state.dataPane).toBeUndefined();
    });

    it('should exist if panel is supporting querying', () => {
      const { panelEditor } = setup({ pluginSkipDataQuery: false });

      expect(panelEditor.state.dataPane).toBeDefined();
    });
  });
});

interface SetupOptions {
  isNewPanel?: boolean;
  pluginSkipDataQuery?: boolean;
  repeatByVariable?: string;
}

function setup(options: SetupOptions = {}) {
  pluginToLoad = getPanelPlugin({ id: 'text', skipDataQuery: options.pluginSkipDataQuery });

  const panel = new VizPanel({
    key: 'panel-1',
    pluginId: 'text',
    title: 'original title',
    $data: new SceneDataTransformer({
      transformations: [],
      $data: new SceneQueryRunner({
        queries: [{ refId: 'A' }],
        maxDataPoints: 500,
        datasource: { uid: 'ds1' },
      }),
    }),
  });

  const gridItem = new DashboardGridItem({ body: panel, variableName: options.repeatByVariable });

  const panelEditor = buildPanelEditScene(panel, options.isNewPanel);
  const dashboard = new DashboardScene({
    editPanel: panelEditor,
    isEditing: true,
    $variables: new SceneVariableSet({
      variables: [
        new CustomVariable({
          name: 'server',
          query: 'A,B,C',
          isMulti: true,
          value: ['A', 'B', 'C'],
          text: ['A', 'B', 'C'],
        }),
      ],
    }),
    body: new SceneGridLayout({
      children: [gridItem],
    }),
  });

  panelEditor.debounceSaveModelDiff = false;

  deactivate = activateFullSceneTree(dashboard);

  return { dashboard, panel, gridItem, panelEditor };
}
