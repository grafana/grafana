import { of } from 'rxjs';

import { FieldType, LoadingState, PanelData, getDefaultTimeRange, toDataFrame } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { config, setPluginImportUtils, setRunRequest } from '@grafana/runtime';
import {
  SceneCanvasText,
  SceneGridLayout,
  SceneGridRow,
  SceneVariableSet,
  TestVariable,
  VizPanel,
} from '@grafana/scenes';
import { LibraryPanel } from '@grafana/schema';
import * as libpanels from 'app/features/library-panels/state/api';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardScene } from './DashboardScene';
import { LibraryPanelBehavior } from './LibraryPanelBehavior';
import {
  SoloPanelContextWithPathIdFilter,
  hasAnyLibraryPanelLoading,
  hasAnyPendingRepeats,
  isStillLoading,
} from './SoloPanelContext';
import { DashboardGridItem } from './layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getPluginLinkExtensions: jest.fn(() => ({ extensions: [] })),
  getDataSourceSrv: () => ({
    get: jest.fn().mockResolvedValue({ getRef: () => ({ uid: 'ds1' }) }),
    getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds1' }),
  }),
}));

const runRequestMock = jest.fn().mockReturnValue(
  of<PanelData>({
    state: LoadingState.Done,
    timeRange: getDefaultTimeRange(),
    series: [
      toDataFrame({
        fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3] }],
      }),
    ],
    request: {
      app: 'dashboard',
      requestId: 'request-id',
      dashboardUID: 'asd',
      interval: '1s',
      panelId: 1,
      range: getDefaultTimeRange(),
      targets: [],
      timezone: 'utc',
      intervalMs: 1000,
      startTime: 1,
      scopedVars: {
        __sceneObject: { value: new SceneCanvasText({ text: 'asd' }) },
      },
    },
  })
);

setRunRequest(runRequestMock);

jest.mock('app/features/library-panels/state/api', () => ({
  getLibraryPanel: jest.fn(),
}));

describe('Library panel with repeat - solo panel view', () => {
  const originalDashboardNewLayouts = config.featureToggles.dashboardNewLayouts;

  afterEach(() => {
    config.featureToggles.dashboardNewLayouts = originalDashboardNewLayouts;
  });

  describe('SoloPanelContextWithPathIdFilter matching', () => {
    it('should match pathId for a regular repeated panel', () => {
      const { scene, repeater } = buildScene({ useLibraryPanel: false, initRepeatedPanels: true });
      activateFullSceneTree(scene);

      expect(repeater.state.repeatedPanels?.length).toBe(1);

      const body = repeater.state.body;
      const clone = repeater.state.repeatedPanels![0];

      expect(body.getPathId()).toBe('1$panel-2');
      expect(clone.getPathId()).toBe('2$panel-2');

      const filter = new SoloPanelContextWithPathIdFilter('2$panel-2');
      expect(filter.matches(body)).toBe(false);
      expect(filter.matches(clone)).toBe(true);
      expect(filter.matchFound).toBe(true);
    });

    it('should match pathId for a library panel with repeat (pre-initialized repeats)', () => {
      const { scene, repeater } = buildScene({ useLibraryPanel: true, initRepeatedPanels: true });
      activateFullSceneTree(scene);

      expect(repeater.state.repeatedPanels?.length).toBe(1);

      const body = repeater.state.body;
      const clone = repeater.state.repeatedPanels![0];

      expect(body.getPathId()).toBe('1$panel-2');
      expect(clone.getPathId()).toBe('2$panel-2');

      const filter = new SoloPanelContextWithPathIdFilter('2$panel-2');
      expect(filter.matches(body)).toBe(false);
      expect(filter.matches(clone)).toBe(true);
      expect(filter.matchFound).toBe(true);
    });

    it('should match pathId for a library panel after setPanelFromLibPanel runs', () => {
      const { scene, repeater } = buildScene({ useLibraryPanel: true, initRepeatedPanels: true });
      activateFullSceneTree(scene);

      const body = repeater.state.body;
      const clone = repeater.state.repeatedPanels![0];

      const bodyBehavior = body.state.$behaviors?.find(
        (b) => b instanceof LibraryPanelBehavior
      ) as LibraryPanelBehavior;
      const cloneBehavior = clone.state.$behaviors?.find(
        (b) => b instanceof LibraryPanelBehavior
      ) as LibraryPanelBehavior;

      bodyBehavior.setPanelFromLibPanel(makeLibPanelResponse());
      cloneBehavior.setPanelFromLibPanel(makeLibPanelResponse());

      expect(body.state.pluginId).toBe('timeseries');
      expect(clone.state.pluginId).toBe('timeseries');

      expect(body.getPathId()).toBe('1$panel-2');
      expect(clone.getPathId()).toBe('2$panel-2');

      const filter = new SoloPanelContextWithPathIdFilter('2$panel-2');
      expect(filter.matches(clone)).toBe(true);
      expect(filter.matchFound).toBe(true);
    });
  });

  describe('hasAnyPendingRepeats', () => {
    it('should detect pending repeats when repeatedPanels is undefined', () => {
      const { scene } = buildScene({ useLibraryPanel: false, initRepeatedPanels: false });

      expect(hasAnyPendingRepeats(scene)).toBe(true);
    });

    it('should not detect pending repeats after activation completes', () => {
      const { scene, repeater } = buildScene({ useLibraryPanel: false, initRepeatedPanels: false });
      activateFullSceneTree(scene);

      expect(repeater.state.repeatedPanels).toBeDefined();
      expect(repeater.state.repeatedPanels!.length).toBe(1);
      expect(hasAnyPendingRepeats(scene)).toBe(false);
    });

    it('should not report pending repeats for non-repeating items', () => {
      const body = new VizPanel({ title: 'Panel', key: 'panel-3', pluginId: 'timeseries' });
      const gridItem = new DashboardGridItem({ body, x: 0, y: 0 });
      const scene = new DashboardScene({
        $variables: new SceneVariableSet({ variables: [] }),
        body: new DefaultGridLayoutManager({
          grid: new SceneGridLayout({ children: [gridItem] }),
        }),
      });

      expect(hasAnyPendingRepeats(scene)).toBe(false);
    });

    it('should detect pending repeats inside a SceneGridRow', () => {
      const body = new VizPanel({
        title: 'Panel',
        key: 'panel-2',
        pluginId: 'timeseries',
      });
      const repeater = new DashboardGridItem({ variableName: 'server', body, x: 0, y: 0 });
      const row = new SceneGridRow({ children: [repeater] });
      const scene = new DashboardScene({
        $variables: new SceneVariableSet({
          variables: [
            new TestVariable({
              name: 'server',
              query: 'A.*',
              value: ALL_VARIABLE_VALUE,
              text: ALL_VARIABLE_TEXT,
              isMulti: true,
              includeAll: true,
              optionsToReturn: [
                { label: 'A', value: '1' },
                { label: 'B', value: '2' },
              ],
            }),
          ],
        }),
        body: new DefaultGridLayoutManager({
          grid: new SceneGridLayout({ children: [row] }),
        }),
      });

      expect(hasAnyPendingRepeats(scene)).toBe(true);
    });
  });

  describe('hasAnyLibraryPanelLoading', () => {
    it('should detect unloaded library panels', () => {
      const { scene } = buildScene({ useLibraryPanel: true, initRepeatedPanels: true });

      expect(hasAnyLibraryPanelLoading(scene)).toBe(true);
    });

    it('should not detect library panels as loading after setPanelFromLibPanel', () => {
      const { scene, repeater } = buildScene({ useLibraryPanel: true, initRepeatedPanels: true });
      activateFullSceneTree(scene);

      const body = repeater.state.body;
      const behavior = body.state.$behaviors?.find((b) => b instanceof LibraryPanelBehavior) as LibraryPanelBehavior;
      behavior.setPanelFromLibPanel(makeLibPanelResponse());

      expect(hasAnyLibraryPanelLoading(scene)).toBe(false);
    });

    it('should return false for panels without library panel behavior', () => {
      const body = new VizPanel({ title: 'Panel', key: 'panel-3', pluginId: 'timeseries' });
      const gridItem = new DashboardGridItem({ body, x: 0, y: 0 });
      const scene = new DashboardScene({
        $variables: new SceneVariableSet({ variables: [] }),
        body: new DefaultGridLayoutManager({
          grid: new SceneGridLayout({ children: [gridItem] }),
        }),
      });

      expect(hasAnyLibraryPanelLoading(scene)).toBe(false);
    });
  });

  describe('isStillLoading', () => {
    it('should be true when variables are not active', () => {
      const { scene } = buildScene({ useLibraryPanel: false, initRepeatedPanels: true });

      expect(isStillLoading(scene)).toBe(true);
    });

    it('should be true when library panel is not loaded', () => {
      const { scene } = buildScene({ useLibraryPanel: true, initRepeatedPanels: true });
      activateFullSceneTree(scene);

      expect(isStillLoading(scene)).toBe(true);
    });

    it('should be true when repeatedPanels is undefined', () => {
      const { scene } = buildScene({ useLibraryPanel: false, initRepeatedPanels: false });

      expect(isStillLoading(scene)).toBe(true);
    });

    it('should be false when everything is loaded and repeats are processed', () => {
      const { scene, repeater } = buildScene({ useLibraryPanel: false, initRepeatedPanels: false });
      activateFullSceneTree(scene);

      expect(repeater.state.repeatedPanels).toBeDefined();
      expect(isStillLoading(scene)).toBe(false);
    });
  });

  describe('end-to-end: library panel loads', () => {
    it('should keep isStillLoading true until library panel finishes loading', async () => {
      config.featureToggles.dashboardNewLayouts = false;

      let resolveLibPanel!: (value: LibraryPanel) => void;
      const libPanelPromise = new Promise<LibraryPanel>((r) => {
        resolveLibPanel = r;
      });
      jest.spyOn(libpanels, 'getLibraryPanel').mockReturnValue(libPanelPromise);

      const behavior = new LibraryPanelBehavior({ uid: 'lib-panel-uid', name: 'My Library Panel' });
      const body = new VizPanel({
        title: 'Library Panel',
        key: 'panel-2',
        pluginId: LibraryPanelBehavior.LOADING_VIZ_PANEL_PLUGIN_ID,
        $behaviors: [behavior],
      });

      const gridItem = new DashboardGridItem({ body, x: 0, y: 0, width: 24, height: 10 });

      const scene = new DashboardScene({
        uid: 'dash-1',
        meta: { canEdit: true },
        $variables: new SceneVariableSet({
          variables: [
            new TestVariable({
              name: 'server',
              query: 'A.*',
              value: ALL_VARIABLE_VALUE,
              text: ALL_VARIABLE_TEXT,
              isMulti: true,
              includeAll: true,
              delayMs: 0,
              optionsToReturn: [
                { label: 'A', value: '1' },
                { label: 'B', value: '2' },
              ],
            }),
          ],
        }),
        body: new DefaultGridLayoutManager({
          grid: new SceneGridLayout({ children: [gridItem] }),
        }),
      });

      activateFullSceneTree(scene);

      // Library panel is still loading — isStillLoading should be true
      expect(hasAnyLibraryPanelLoading(scene)).toBe(true);
      expect(isStillLoading(scene)).toBe(true);

      // Resolve the library panel fetch
      resolveLibPanel(makeLibPanelResponseWithRepeat('server'));
      await new Promise((r) => setTimeout(r, 10));

      expect(behavior.state.isLoaded).toBe(true);
      expect(gridItem.state.variableName).toBe('server');
      expect(gridItem.state.repeatedPanels).toBeDefined();
      expect(hasAnyLibraryPanelLoading(scene)).toBe(false);
      expect(isStillLoading(scene)).toBe(false);
    });

    it('should work when variableName is already on the grid item (dashboardNewLayouts)', () => {
      config.featureToggles.dashboardNewLayouts = true;

      jest.spyOn(libpanels, 'getLibraryPanel').mockResolvedValue(makeLibPanelResponseWithRepeat('server'));

      const behavior = new LibraryPanelBehavior({ uid: 'lib-panel-uid', name: 'My Library Panel' });
      const body = new VizPanel({
        title: 'Library Panel',
        key: 'panel-2',
        pluginId: LibraryPanelBehavior.LOADING_VIZ_PANEL_PLUGIN_ID,
        $behaviors: [behavior],
      });

      const gridItem = new DashboardGridItem({
        variableName: 'server',
        repeatedPanels: [],
        body,
        x: 0,
        y: 0,
        width: 24,
        height: 10,
      });

      const scene = new DashboardScene({
        uid: 'dash-1',
        meta: { canEdit: true },
        $variables: new SceneVariableSet({
          variables: [
            new TestVariable({
              name: 'server',
              query: 'A.*',
              value: ALL_VARIABLE_VALUE,
              text: ALL_VARIABLE_TEXT,
              isMulti: true,
              includeAll: true,
              delayMs: 0,
              optionsToReturn: [
                { label: 'A', value: '1' },
                { label: 'B', value: '2' },
              ],
            }),
          ],
        }),
        body: new DefaultGridLayoutManager({
          grid: new SceneGridLayout({ children: [gridItem] }),
        }),
      });

      activateFullSceneTree(scene);

      expect(gridItem.state.repeatedPanels).toBeDefined();
      expect(gridItem.state.repeatedPanels!.length).toBe(1);

      const clone = gridItem.state.repeatedPanels![0];
      const filter = new SoloPanelContextWithPathIdFilter('2$panel-2');
      expect(filter.matches(clone)).toBe(true);
    });
  });
});

interface BuildSceneOptions {
  useLibraryPanel: boolean;
  initRepeatedPanels: boolean;
  variableQueryTime?: number;
}

function buildScene(options: BuildSceneOptions) {
  const { useLibraryPanel, initRepeatedPanels, variableQueryTime = 0 } = options;

  const panelState: Record<string, unknown> = {
    title: 'Panel $server',
    key: 'panel-2',
    pluginId: useLibraryPanel ? LibraryPanelBehavior.LOADING_VIZ_PANEL_PLUGIN_ID : 'timeseries',
  };

  if (useLibraryPanel) {
    panelState.$behaviors = [
      new LibraryPanelBehavior({
        uid: 'lib-panel-uid',
        name: 'My Library Panel',
      }),
    ];
  }

  const body = new VizPanel(panelState);

  const repeater = new DashboardGridItem({
    variableName: 'server',
    body,
    x: 0,
    y: 0,
    ...(initRepeatedPanels ? { repeatedPanels: [] } : {}),
  });

  const variable = new TestVariable({
    name: 'server',
    query: 'A.*',
    value: ALL_VARIABLE_VALUE,
    text: ALL_VARIABLE_TEXT,
    isMulti: true,
    includeAll: true,
    delayMs: variableQueryTime,
    optionsToReturn: [
      { label: 'A', value: '1' },
      { label: 'B', value: '2' },
    ],
  });

  const scene = new DashboardScene({
    $variables: new SceneVariableSet({
      variables: [variable],
    }),
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({ children: [repeater] }),
    }),
  });

  return { scene, repeater, variable };
}

function makeLibPanelResponse(): LibraryPanel {
  return {
    uid: 'lib-panel-uid',
    name: 'My Library Panel',
    type: 'timeseries',
    version: 1,
    model: {
      type: 'timeseries',
      title: 'Library Panel Title',
      options: {},
      fieldConfig: { defaults: {}, overrides: [] },
      datasource: { uid: 'test', type: 'test' },
      targets: [],
    },
  };
}

function makeLibPanelResponseWithRepeat(repeatVar: string): LibraryPanel {
  return {
    uid: 'lib-panel-uid',
    name: 'My Library Panel',
    type: 'timeseries',
    version: 1,
    model: {
      type: 'timeseries',
      title: 'Library Panel Title',
      repeat: repeatVar,
      repeatDirection: 'h',
      maxPerRow: 4,
      options: {},
      fieldConfig: { defaults: {}, overrides: [] },
      datasource: { uid: 'test', type: 'test' },
      targets: [],
    },
  };
}
