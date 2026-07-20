import {
  DataQueryErrorType,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  type PanelPlugin,
  toDataFrame,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneDataNode, SceneDataTransformer, sceneGraph, type VizPanel } from '@grafana/scenes';

import type { DashboardScene } from '../../scene/DashboardScene';
import { type AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { PanelTimeRange } from '../../scene/panel-timerange/PanelTimeRange';
import { getUpdatedHoverHeader } from '../../scene/panel-timerange/utils';
import { getQueryRunnerFor } from '../../utils/utils';
import { DashboardMutationClient } from '../DashboardMutationClient';
import type { PanelElementEntry, PanelElementsData, MutationResult } from '../types';

jest.mock('@grafana/data', () => {
  const actual = jest.requireActual('@grafana/data');
  return {
    ...actual,
    getPanelOptionsWithDefaults: jest.fn(({ currentOptions, currentFieldConfig }) => ({
      options: currentOptions ?? {},
      fieldConfig: currentFieldConfig ?? { defaults: {}, overrides: [] },
    })),
  };
});

jest.mock('../../edit-pane/shared', () => {
  const actual = jest.requireActual('../../edit-pane/shared');
  return {
    ...actual,
    dashboardEditActions: {
      ...actual.dashboardEditActions,
      edit(props: { perform: () => void }) {
        props.perform();
      },
      addElement(props: { perform: () => void }) {
        props.perform();
      },
      removeElement(props: { perform: () => void }) {
        props.perform();
      },
    },
  };
});

let currentTestScene: unknown;

jest.mock('../../utils/utils', () => {
  const actual = jest.requireActual('../../utils/utils');
  return {
    ...actual,
    getDashboardSceneFor: jest.fn(() => currentTestScene ?? { state: { isEditing: true } }),
  };
});

function mockSerializer(elementMap: Record<string, number> = {}) {
  const reverseMap: Record<number, string> = {};
  for (const [name, id] of Object.entries(elementMap)) {
    reverseMap[id] = name;
  }

  function ensureMapping(panelId: number): string {
    if (reverseMap[panelId]) {
      return reverseMap[panelId];
    }
    const key = `panel-${panelId}`;
    elementMap[key] = panelId;
    reverseMap[panelId] = key;
    return key;
  }

  return {
    getPanelIdForElement: jest.fn((name: string) => elementMap[name]),
    getElementIdForPanel: jest.fn((id: number) => ensureMapping(id)),
    getDSReferencesMapping: jest.fn(() => ({
      panels: new Map(),
      variables: new Map(),
      annotations: new Map(),
    })),
  };
}

function buildPanelScene(panels: VizPanel[] = [], elementMap: Record<string, number> = {}): DashboardScene {
  const body = DefaultGridLayoutManager.fromVizPanels(panels);
  const state: Record<string, unknown> = {
    uid: 'test-dash',
    isEditing: false,
    body,
  };

  const scene = {
    state,
    serializer: mockSerializer(elementMap),
    canEditDashboard: jest.fn(() => true),
    onEnterEditMode: jest.fn(() => {
      state.isEditing = true;
    }),
    activateEditPane: jest.fn(),
    forceRender: jest.fn(),
    setState: jest.fn((partial: Record<string, unknown>) => {
      Object.assign(state, partial);
    }),
    updatePanelTitle: jest.fn((panel: VizPanel, title: string) => {
      panel.setState({ title, hoverHeader: getUpdatedHoverHeader(title, panel.state.$timeRange?.state) });
    }),
    changePanelPlugin: jest.fn(),
  };

  currentTestScene = scene;

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return scene as unknown as DashboardScene;
}

function buildAutoGridPanelScene(panels: VizPanel[] = [], elementMap: Record<string, number> = {}): DashboardScene {
  const body = AutoGridLayoutManager.createFromLayout(DefaultGridLayoutManager.fromVizPanels(panels));
  const state: Record<string, unknown> = {
    uid: 'test-dash',
    isEditing: false,
    body,
  };

  const scene = {
    state,
    serializer: mockSerializer(elementMap),
    canEditDashboard: jest.fn(() => true),
    onEnterEditMode: jest.fn(() => {
      state.isEditing = true;
    }),
    activateEditPane: jest.fn(),
    forceRender: jest.fn(),
    setState: jest.fn((partial: Record<string, unknown>) => {
      Object.assign(state, partial);
    }),
    updatePanelTitle: jest.fn((panel: VizPanel, title: string) => {
      panel.setState({ title, hoverHeader: getUpdatedHoverHeader(title, panel.state.$timeRange?.state) });
    }),
    changePanelPlugin: jest.fn(),
  };

  currentTestScene = scene;

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return scene as unknown as DashboardScene;
}

function makePanelPayload(title: string, pluginId = 'timeseries', options?: Record<string, unknown>) {
  return {
    kind: 'Panel' as const,
    spec: {
      title,
      data: {
        kind: 'QueryGroup' as const,
        spec: {
          queries: [
            {
              kind: 'PanelQuery' as const,
              spec: {
                refId: 'A',
                query: {
                  kind: 'DataQuery' as const,
                  group: 'prometheus',
                  spec: { expr: 'up' },
                },
              },
            },
          ],
        },
      },
      vizConfig: {
        kind: 'VizConfig' as const,
        group: pluginId,
        spec: options ? { options } : {},
      },
    },
  };
}

function getElementName(data: unknown): string {
  const d = data as { layoutItem: { spec: { element: { name: string } } } };
  return d.layoutItem.spec.element.name;
}

async function addPanel(
  client: DashboardMutationClient,
  title: string,
  pluginId?: string,
  options?: Record<string, unknown>
) {
  const result = await client.execute({
    type: 'ADD_PANEL',
    payload: { panel: makePanelPayload(title, pluginId, options) },
  });
  if (!result.success) {
    throw new Error(`ADD_PANEL failed: ${result.error}`);
  }
  return getElementName(result.data);
}

function makePanelData(overrides: Partial<PanelData>): PanelData {
  return { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange(), ...overrides };
}

// Attaches a live data provider to an already-added panel so LIST_PANELS can read its runtime status.
function attachPanelData(scene: DashboardScene, title: string, data: PanelData) {
  const panel = scene.state.body.getVizPanels().find((p) => p.state.title === title);
  if (!panel) {
    throw new Error(`panel not found: ${title}`);
  }
  panel.setState({ $data: new SceneDataTransformer({ $data: new SceneDataNode({ data }), transformations: [] }) });
}

describe('Panel mutation commands', () => {
  beforeEach(() => {
    jest.spyOn(sceneGraph, 'getTimeRange').mockReturnValue({
      onRefresh: jest.fn(),
      subscribeToState: jest.fn(() => ({ unsubscribe: jest.fn() })),
      useState: jest.fn(() => ({})),
      state: { from: 'now-6h', to: 'now', value: {} },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('LIST_PANELS', () => {
    it('returns elements from the dashboard as an array', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      await addPanel(client, 'Panel A');
      await addPanel(client, 'Panel B');

      const result = await client.execute({ type: 'LIST_PANELS', payload: {} });

      expect(result.success).toBe(true);
      const data = result.data as PanelElementsData;
      expect(data.elements).toHaveLength(2);
    });

    it('returns empty array for dashboard with no panels', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const result = await client.execute({ type: 'LIST_PANELS', payload: {} });

      expect(result.success).toBe(true);
      const data = result.data as PanelElementsData;
      expect(data.elements).toHaveLength(0);
    });

    it('includes layoutItem with element reference for each entry', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      await addPanel(client, 'Panel A');

      const result = await client.execute({ type: 'LIST_PANELS', payload: {} });
      const data = result.data as PanelElementsData;

      expect(data.elements[0].layoutItem).toBeDefined();
      expect(data.elements[0].layoutItem.kind).toBe('GridLayoutItem');
      expect(data.elements[0].layoutItem.spec.element.name).toBeDefined();
    });

    it('filters by element names when elements is provided', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const nameA = await addPanel(client, 'Panel A');
      await addPanel(client, 'Panel B');
      await addPanel(client, 'Panel C');

      const result = await client.execute({
        type: 'LIST_PANELS',
        payload: { elements: [nameA] },
      });

      expect(result.success).toBe(true);
      const data = result.data as PanelElementsData;
      expect(data.elements).toHaveLength(1);
      expect(data.elements[0].layoutItem.spec.element.name).toBe(nameA);
    });

    it('returns empty array when elements filter matches nothing', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      await addPanel(client, 'Panel A');

      const result = await client.execute({
        type: 'LIST_PANELS',
        payload: { elements: ['nonexistent'] },
      });

      expect(result.success).toBe(true);
      const data = result.data as PanelElementsData;
      expect(data.elements).toHaveLength(0);
    });

    it('includeStatus reports the loading state for a loading panel', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);
      const name = await addPanel(client, 'Loading Panel');
      attachPanelData(scene, 'Loading Panel', makePanelData({ state: LoadingState.Loading }));

      const result = await client.execute({
        type: 'LIST_PANELS',
        payload: { elements: [name], includeStatus: true },
      });
      const entry = (result.data as PanelElementsData).elements[0];

      expect(entry.status).toEqual({
        loadingState: LoadingState.Loading,
        hasError: false,
        hasNoData: false,
      });
      expect(entry.dataSchema).toBeUndefined();
    });

    it('includeStatus reports structured errors with refId and type', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);
      const name = await addPanel(client, 'Error Panel');
      attachPanelData(
        scene,
        'Error Panel',
        makePanelData({
          state: LoadingState.Error,
          errors: [{ message: 'boom', refId: 'A', type: DataQueryErrorType.Unknown }],
        })
      );

      const result = await client.execute({
        type: 'LIST_PANELS',
        payload: { elements: [name], includeStatus: true },
      });
      const status = (result.data as PanelElementsData).elements[0].status;

      expect(status?.hasError).toBe(true);
      expect(status?.loadingState).toBe(LoadingState.Error);
      expect(status?.errors).toEqual([
        { source: 'query', message: 'boom', refId: 'A', type: DataQueryErrorType.Unknown },
      ]);
    });

    it('includeStatus reads the error message from data.message when the top-level message is absent', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);
      const name = await addPanel(client, 'Backend Error Panel');
      attachPanelData(
        scene,
        'Backend Error Panel',
        makePanelData({
          state: LoadingState.Error,
          errors: [{ refId: 'A', data: { message: 'backend boom' } }],
        })
      );

      const result = await client.execute({
        type: 'LIST_PANELS',
        payload: { elements: [name], includeStatus: true },
      });
      const status = (result.data as PanelElementsData).elements[0].status;

      expect(status?.hasError).toBe(true);
      expect(status?.errors).toEqual([{ source: 'query', message: 'backend boom', refId: 'A' }]);
    });

    it('includeStatus does not flag hasError for an error object with no usable message (Done state)', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);
      const name = await addPanel(client, 'Empty Error Panel');
      attachPanelData(
        scene,
        'Empty Error Panel',
        makePanelData({ state: LoadingState.Done, series: [], errors: [{}] })
      );

      const result = await client.execute({
        type: 'LIST_PANELS',
        payload: { elements: [name], includeStatus: true },
      });
      const status = (result.data as PanelElementsData).elements[0].status;

      expect(status?.hasError).toBe(false);
      expect(status?.errors).toBeUndefined();
    });

    it('includeStatus surfaces a plugin load error as a hard error, even with a data provider present', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);
      const name = await addPanel(client, 'Broken Plugin Panel');
      // Healthy data underneath, but the panel plugin failed to load.
      attachPanelData(scene, 'Broken Plugin Panel', makePanelData({ state: LoadingState.Done }));
      const panel = scene.state.body.getVizPanels().find((p) => p.state.title === 'Broken Plugin Panel');
      panel?.setState({ _pluginLoadError: 'Failed to load panel plugin' });

      const result = await client.execute({
        type: 'LIST_PANELS',
        payload: { elements: [name], includeStatus: true },
      });
      const status = (result.data as PanelElementsData).elements[0].status;

      expect(status).toEqual({
        loadingState: LoadingState.Error,
        hasError: true,
        hasNoData: false,
        errors: [{ source: 'plugin', message: 'Failed to load panel plugin' }],
      });
    });

    it('includeStatus surfaces a plugin compile error (loadError) even without _pluginLoadError', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);
      const name = await addPanel(client, 'Compile Error Panel');
      attachPanelData(scene, 'Compile Error Panel', makePanelData({ state: LoadingState.Done }));
      const panel = scene.state.body.getVizPanels().find((p) => p.state.title === 'Compile Error Panel')!;
      // Compile failure: error plugin with loadError, no _pluginLoadError set.
      jest.spyOn(panel, 'getPlugin').mockReturnValue({ loadError: true } as unknown as PanelPlugin);

      const result = await client.execute({
        type: 'LIST_PANELS',
        payload: { elements: [name], includeStatus: true },
      });
      const status = (result.data as PanelElementsData).elements[0].status;

      expect(status?.hasError).toBe(true);
      expect(status?.loadingState).toBe(LoadingState.Error);
      expect(status?.errors?.[0].source).toBe('plugin');
    });

    it('includeStatus reports hasNoData for a done panel with no series', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);
      const name = await addPanel(client, 'Empty Panel');
      attachPanelData(scene, 'Empty Panel', makePanelData({ state: LoadingState.Done, series: [] }));

      const result = await client.execute({
        type: 'LIST_PANELS',
        payload: { elements: [name], includeStatus: true },
      });
      const status = (result.data as PanelElementsData).elements[0].status;

      expect(status?.hasNoData).toBe(true);
      expect(status?.hasError).toBe(false);
      expect(status?.loadingState).toBe(LoadingState.Done);
    });

    it('surfaces deduped data-frame notices (includeStatus) and the frame schema (includeSchema)', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);
      const name = await addPanel(client, 'Notice Panel');
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1] },
          { name: 'value', type: FieldType.number, values: [2] },
        ],
        meta: { notices: [{ severity: 'warning', text: 'slow query' }] },
      });
      attachPanelData(scene, 'Notice Panel', makePanelData({ state: LoadingState.Done, series: [frame, frame] }));

      const result = await client.execute({
        type: 'LIST_PANELS',
        payload: { elements: [name], includeStatus: true, includeSchema: true },
      });
      const entry = (result.data as PanelElementsData).elements[0];

      expect(entry.status?.notices).toEqual([{ severity: 'warning', text: 'slow query' }]);
      expect(entry.status?.hasNoData).toBe(false);
      expect(entry.dataSchema?.[0].fields.map((f) => f.name)).toEqual(['time', 'value']);
    });

    it('includeStatus and includeSchema are independent', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);
      const name = await addPanel(client, 'Independent Panel');
      const frame = toDataFrame({ fields: [{ name: 'time', type: FieldType.time, values: [1] }] });
      attachPanelData(scene, 'Independent Panel', makePanelData({ state: LoadingState.Done, series: [frame] }));

      const statusOnly = (
        (await client.execute({ type: 'LIST_PANELS', payload: { elements: [name], includeStatus: true } }))
          .data as PanelElementsData
      ).elements[0];
      expect(statusOnly.status).toBeDefined();
      expect(statusOnly.dataSchema).toBeUndefined();

      const schemaOnly = (
        (await client.execute({ type: 'LIST_PANELS', payload: { elements: [name], includeSchema: true } }))
          .data as PanelElementsData
      ).elements[0];
      expect(schemaOnly.dataSchema).toBeDefined();
      expect(schemaOnly.status).toBeUndefined();
    });

    it('includeStatus folds an error-severity notice into errors, not notices', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);
      const name = await addPanel(client, 'Error Notice Panel');
      const frame = toDataFrame({
        fields: [{ name: 'time', type: FieldType.time, values: [1] }],
        meta: {
          notices: [
            { severity: 'error', text: 'datasource rejected the query' },
            { severity: 'info', text: 'sampled' },
          ],
        },
      });
      attachPanelData(scene, 'Error Notice Panel', makePanelData({ state: LoadingState.Done, series: [frame] }));

      const result = await client.execute({
        type: 'LIST_PANELS',
        payload: { elements: [name], includeStatus: true },
      });
      const status = (result.data as PanelElementsData).elements[0].status;

      expect(status?.hasError).toBe(true);
      expect(status?.errors).toEqual([{ source: 'notice', message: 'datasource rejected the query' }]);
      expect(status?.notices).toEqual([{ severity: 'info', text: 'sampled' }]);
    });

    it('does not attach status when includeStatus is not set', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);
      const name = await addPanel(client, 'Plain Panel');
      attachPanelData(scene, 'Plain Panel', makePanelData({ state: LoadingState.Done }));

      const result = await client.execute({ type: 'LIST_PANELS', payload: { elements: [name] } });
      const entry = (result.data as PanelElementsData).elements[0];

      expect('status' in entry).toBe(false);
      expect('dataSchema' in entry).toBe(false);
    });

    it('reports loading for a panel whose query has not resolved yet', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);
      const name = await addPanel(client, 'Pending Panel');

      const result = await client.execute({
        type: 'LIST_PANELS',
        payload: { elements: [name], includeStatus: true },
      });
      const status = (result.data as PanelElementsData).elements[0].status;

      expect(status?.loadingState).toBe(LoadingState.Loading);
      expect(status?.hasError).toBe(false);
    });

    it('omits status for a panel without a data provider', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);
      const name = await addPanel(client, 'No Data Provider');
      const panel = scene.state.body.getVizPanels().find((p) => p.state.title === 'No Data Provider');
      panel?.setState({ $data: undefined });

      const result = await client.execute({
        type: 'LIST_PANELS',
        payload: { elements: [name], includeStatus: true },
      });
      const entry = (result.data as PanelElementsData).elements[0];

      expect(entry.status).toBeUndefined();
    });
  });

  describe('ADD_PANEL', () => {
    it('adds a panel to the dashboard', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const result: MutationResult = await client.execute({
        type: 'ADD_PANEL',
        payload: { panel: makePanelPayload('New Panel') },
      });

      expect(result.success).toBe(true);
      expect(result.changes.length).toBeGreaterThan(0);

      const body = scene.state.body as unknown as DefaultGridLayoutManager;
      expect(body.getVizPanels()).toHaveLength(1);
      expect(body.getVizPanels()[0].state.title).toBe('New Panel');
    });

    it('returns element and layoutItem with element reference', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const result = await client.execute({
        type: 'ADD_PANEL',
        payload: { panel: makePanelPayload('Test Panel') },
      });

      expect(result.success).toBe(true);
      const data = result.data as PanelElementEntry;
      expect(data.element).toBeDefined();
      expect(data.layoutItem).toBeDefined();
      expect(data.layoutItem.kind).toBe('GridLayoutItem');
      expect(data.layoutItem.spec.element.name).toBeDefined();
    });

    it('panel gets auto-assigned ID', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const result = await client.execute({
        type: 'ADD_PANEL',
        payload: { panel: makePanelPayload('Auto ID Panel') },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as DefaultGridLayoutManager;
      const panels = body.getVizPanels();
      expect(panels[0].state.key).toMatch(/^panel-\d+$/);
    });

    it('rejects invalid panel spec', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const result = await client.execute({
        type: 'ADD_PANEL',
        payload: { panel: { invalid: true } },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('emits warning when layoutItem kind does not match target layout', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const result = await client.execute({
        type: 'ADD_PANEL',
        payload: {
          panel: makePanelPayload('Panel with AutoGrid Item'),
          layoutItem: {
            kind: 'AutoGridLayoutItem',
            spec: {},
          },
        },
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings![0]).toContain('adapted');
    });

    it('applies layoutItem spec to grid position', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const result = await client.execute({
        type: 'ADD_PANEL',
        payload: {
          panel: makePanelPayload('Positioned Panel'),
          layoutItem: { spec: { x: 6, y: 3, width: 8, height: 5 } },
        },
      });

      expect(result.success).toBe(true);
      const data = result.data as PanelElementEntry;
      expect(data.layoutItem.kind).toBe('GridLayoutItem');
      const gridSpec = data.layoutItem.spec as { x: number; y: number; width: number; height: number };
      expect(gridSpec.x).toBe(6);
      expect(gridSpec.y).toBe(3);
      expect(gridSpec.width).toBe(8);
      expect(gridSpec.height).toBe(5);
    });
  });

  describe('UPDATE_PANEL', () => {
    it('updates panel title', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const elementName = await addPanel(client, 'Original Title');

      const result = await client.execute({
        type: 'UPDATE_PANEL',
        payload: {
          element: { name: elementName },
          panel: { kind: 'Panel', spec: { title: 'New Title' } },
        },
      });

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      const prev = result.changes[0].previousValue as { kind: string; spec: { title: string } };
      expect(prev.kind).toBe('Panel');
      expect(prev.spec.title).toBe('Original Title');
      const body = scene.state.body as unknown as DefaultGridLayoutManager;
      expect(body.getVizPanels()[0].state.title).toBe('New Title');
    });

    it('sets hoverHeader to true when title is cleared', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const elementName = await addPanel(client, 'Has Title');

      const body = scene.state.body as unknown as DefaultGridLayoutManager;
      expect(body.getVizPanels()[0].state.hoverHeader).toBe(false);

      const result = await client.execute({
        type: 'UPDATE_PANEL',
        payload: {
          element: { name: elementName },
          panel: { kind: 'Panel', spec: { title: '' } },
        },
      });

      expect(result.success).toBe(true);
      expect(body.getVizPanels()[0].state.hoverHeader).toBe(true);
    });

    it('sets hoverHeader to false when title is set from empty', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const elementName = await addPanel(client, '');

      const body = scene.state.body as unknown as DefaultGridLayoutManager;
      expect(body.getVizPanels()[0].state.hoverHeader).toBe(true);

      const result = await client.execute({
        type: 'UPDATE_PANEL',
        payload: {
          element: { name: elementName },
          panel: { kind: 'Panel', spec: { title: 'Now Has Title' } },
        },
      });

      expect(result.success).toBe(true);
      expect(body.getVizPanels()[0].state.hoverHeader).toBe(false);
    });

    it('deep-merges options without losing existing keys', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const elementName = await addPanel(client, 'Options Panel');

      // Manually set known options on the panel for a controlled merge test
      const body = scene.state.body as unknown as DefaultGridLayoutManager;
      const vizPanel = body.getVizPanels()[0];
      vizPanel.onOptionsChange({ legend: { show: true }, tooltip: { mode: 'single' } }, true);

      const result = await client.execute({
        type: 'UPDATE_PANEL',
        payload: {
          element: { name: elementName },
          panel: {
            kind: 'Panel',
            spec: {
              vizConfig: {
                kind: 'VizConfig',
                spec: { options: { tooltip: { mode: 'multi' } } },
              },
            },
          },
        },
      });

      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opts = vizPanel.state.options as Record<string, any>;
      expect(opts.legend.show).toBe(true);
      expect(opts.tooltip.mode).toBe('multi');
    });

    it('replaces queries array entirely', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const elementName = await addPanel(client, 'Query Panel');

      const result = await client.execute({
        type: 'UPDATE_PANEL',
        payload: {
          element: { name: elementName },
          panel: {
            kind: 'Panel',
            spec: {
              data: {
                kind: 'QueryGroup',
                spec: {
                  queries: [
                    {
                      kind: 'PanelQuery',
                      spec: {
                        refId: 'B',
                        query: { kind: 'DataQuery', group: 'loki', spec: { expr: '{job="app"}' } },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      });

      expect(result.success).toBe(true);
    });

    it('applies transformations with filter and topic', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const elementName = await addPanel(client, 'Transform Panel');

      const result = await client.execute({
        type: 'UPDATE_PANEL',
        payload: {
          element: { name: elementName },
          panel: {
            kind: 'Panel',
            spec: {
              data: {
                kind: 'QueryGroup',
                spec: {
                  transformations: [
                    {
                      kind: 'Transformation',
                      group: 'limit',
                      spec: {
                        disabled: false,
                        filter: { id: 'byName', options: 'temperature' },
                        topic: 'series',
                        options: { limitField: 10 },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as DefaultGridLayoutManager;
      const dataProvider = body.getVizPanels()[0].state.$data;
      expect(dataProvider).toBeDefined();
      if (dataProvider && 'state' in dataProvider) {
        const transformerState = dataProvider.state as { transformations?: Array<Record<string, unknown>> };
        expect(transformerState.transformations).toBeDefined();
        expect(transformerState.transformations![0]).toMatchObject({
          id: 'limit',
          disabled: false,
          filter: { id: 'byName', options: 'temperature' },
          topic: 'series',
          options: { limitField: 10 },
        });
      }
    });

    it('updates panel description', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const elementName = await addPanel(client, 'Desc Panel');

      const result = await client.execute({
        type: 'UPDATE_PANEL',
        payload: {
          element: { name: elementName },
          panel: { kind: 'Panel', spec: { description: 'New description' } },
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as DefaultGridLayoutManager;
      expect(body.getVizPanels()[0].state.description).toBe('New description');
    });

    it('updates panel transparent mode', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const elementName = await addPanel(client, 'Transparent Panel');

      const result = await client.execute({
        type: 'UPDATE_PANEL',
        payload: {
          element: { name: elementName },
          panel: { kind: 'Panel', spec: { transparent: true } },
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as DefaultGridLayoutManager;
      expect(body.getVizPanels()[0].state.displayMode).toBe('transparent');
    });

    it('changes plugin type via vizConfig.group', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const elementName = await addPanel(client, 'Plugin Change Panel', 'timeseries');

      const result = await client.execute({
        type: 'UPDATE_PANEL',
        payload: {
          element: { name: elementName },
          panel: {
            kind: 'Panel',
            spec: {
              vizConfig: { kind: 'VizConfig', group: 'stat', spec: { options: { graphMode: 'none' } } },
            },
          },
        },
      });

      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(scene.changePanelPlugin).toHaveBeenCalledWith(
        expect.any(Object),
        'stat',
        { graphMode: 'none' },
        undefined
      );
    });

    it('returns error for non-existent element', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const result = await client.execute({
        type: 'UPDATE_PANEL',
        payload: {
          element: { name: 'nonexistent' },
          panel: { kind: 'Panel', spec: { title: 'Updated' } },
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('applies maxDataPoints via queryOptions', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);
      const elementName = await addPanel(client, 'QO Panel');

      const result = await client.execute({
        type: 'UPDATE_PANEL',
        payload: {
          element: { name: elementName },
          panel: {
            kind: 'Panel',
            spec: { data: { kind: 'QueryGroup', spec: { queryOptions: { maxDataPoints: 500 } } } },
          },
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as DefaultGridLayoutManager;
      const queryRunner = getQueryRunnerFor(body.getVizPanels()[0]);
      expect(queryRunner?.state.maxDataPoints).toBe(500);
    });

    it('maps queryOptions.interval to minInterval on SceneQueryRunner', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);
      const elementName = await addPanel(client, 'Interval Panel');

      const result = await client.execute({
        type: 'UPDATE_PANEL',
        payload: {
          element: { name: elementName },
          panel: {
            kind: 'Panel',
            spec: { data: { kind: 'QueryGroup', spec: { queryOptions: { interval: '30s' } } } },
          },
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as DefaultGridLayoutManager;
      const queryRunner = getQueryRunnerFor(body.getVizPanels()[0]);
      expect(queryRunner?.state.minInterval).toBe('30s');
    });

    it('creates PanelTimeRange from queryOptions.timeFrom', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);
      const elementName = await addPanel(client, 'TimeFrom Panel');

      const result = await client.execute({
        type: 'UPDATE_PANEL',
        payload: {
          element: { name: elementName },
          panel: {
            kind: 'Panel',
            spec: { data: { kind: 'QueryGroup', spec: { queryOptions: { timeFrom: '1h' } } } },
          },
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as DefaultGridLayoutManager;
      const vizPanel = body.getVizPanels()[0];
      expect(vizPanel.state.$timeRange).toBeInstanceOf(PanelTimeRange);

      const tr = vizPanel.state.$timeRange as PanelTimeRange;
      expect(tr.state.timeFrom).toBe('1h');
    });

    it('sets conditionalRendering on an AutoGrid panel', async () => {
      const scene = buildAutoGridPanelScene();
      const client = new DashboardMutationClient(scene);

      const elementName = await addPanel(client, 'Conditional Panel');

      const result = await client.execute({
        type: 'UPDATE_PANEL',
        payload: {
          element: { name: elementName },
          panel: { kind: 'Panel', spec: {} },
          conditionalRendering: {
            kind: 'ConditionalRenderingGroup',
            spec: {
              visibility: 'hide',
              condition: 'and',
              items: [
                {
                  kind: 'ConditionalRenderingVariable',
                  spec: { variable: 'env', operator: 'equals', value: 'prod' },
                },
              ],
            },
          },
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as AutoGridLayoutManager;
      const vizPanel = body.getVizPanels()[0];
      const autoGridItem = vizPanel.parent as AutoGridItem;
      const serialized = autoGridItem.state.conditionalRendering?.serialize();
      expect(serialized?.spec.visibility).toBe('hide');
      expect(serialized?.spec.condition).toBe('and');
      expect(serialized?.spec.items).toHaveLength(1);
      expect(serialized?.spec.items[0].kind).toBe('ConditionalRenderingVariable');
    });

    it('sets conditionalRendering without passing panel', async () => {
      const scene = buildAutoGridPanelScene();
      const client = new DashboardMutationClient(scene);

      const elementName = await addPanel(client, 'No Panel Payload');

      const result = await client.execute({
        type: 'UPDATE_PANEL',
        payload: {
          element: { name: elementName },
          conditionalRendering: {
            kind: 'ConditionalRenderingGroup',
            spec: {
              visibility: 'show',
              condition: 'and',
              items: [{ kind: 'ConditionalRenderingData', spec: { value: true } }],
            },
          },
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as AutoGridLayoutManager;
      const vizPanel = body.getVizPanels()[0];
      expect(vizPanel.state.title).toBe('No Panel Payload');
      const autoGridItem = vizPanel.parent as AutoGridItem;
      const serialized = autoGridItem.state.conditionalRendering?.serialize();
      expect(serialized?.spec.visibility).toBe('show');
      expect(serialized?.spec.items).toHaveLength(1);
    });

    it('rejects conditionalRendering on a GridLayout panel', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const elementName = await addPanel(client, 'Grid Panel');

      const result = await client.execute({
        type: 'UPDATE_PANEL',
        payload: {
          element: { name: elementName },
          panel: { kind: 'Panel', spec: {} },
          conditionalRendering: {
            kind: 'ConditionalRenderingGroup',
            spec: {
              visibility: 'show',
              condition: 'and',
              items: [{ kind: 'ConditionalRenderingData', spec: { value: true } }],
            },
          },
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Auto grid layout');
    });

    it('sets multiple conditions with or logic', async () => {
      const scene = buildAutoGridPanelScene();
      const client = new DashboardMutationClient(scene);

      const elementName = await addPanel(client, 'Multi Condition Panel');

      const result = await client.execute({
        type: 'UPDATE_PANEL',
        payload: {
          element: { name: elementName },
          panel: { kind: 'Panel', spec: {} },
          conditionalRendering: {
            kind: 'ConditionalRenderingGroup',
            spec: {
              visibility: 'show',
              condition: 'or',
              items: [
                {
                  kind: 'ConditionalRenderingVariable',
                  spec: { variable: 'env', operator: 'notEquals', value: 'dev' },
                },
                {
                  kind: 'ConditionalRenderingTimeRangeSize',
                  spec: { value: '6h' },
                },
              ],
            },
          },
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as AutoGridLayoutManager;
      const vizPanel = body.getVizPanels()[0];
      const autoGridItem = vizPanel.parent as AutoGridItem;
      const serialized = autoGridItem.state.conditionalRendering?.serialize();
      expect(serialized?.spec.condition).toBe('or');
      expect(serialized?.spec.items).toHaveLength(2);
      expect(serialized?.spec.items[0].kind).toBe('ConditionalRenderingVariable');
      expect(serialized?.spec.items[1].kind).toBe('ConditionalRenderingTimeRangeSize');
    });
  });

  describe('REMOVE_PANEL', () => {
    it('removes panel from dashboard', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const elementName = await addPanel(client, 'To Remove');

      const result = await client.execute({
        type: 'REMOVE_PANEL',
        payload: { elements: [{ name: elementName }] },
      });

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].previousValue).toBeDefined();
      expect(result.changes[0].previousValue).not.toBe('existed');
      expect(result.changes[0].newValue).toBeNull();
      const body = scene.state.body as unknown as DefaultGridLayoutManager;
      expect(body.getVizPanels()).toHaveLength(0);
    });

    it('removes multiple panels', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const name1 = await addPanel(client, 'Panel 1');
      const name2 = await addPanel(client, 'Panel 2');

      const result = await client.execute({
        type: 'REMOVE_PANEL',
        payload: { elements: [{ name: name1 }, { name: name2 }] },
      });

      expect(result.success).toBe(true);
      const data = result.data as { removed: string[] };
      expect(data.removed).toHaveLength(2);
      const body = scene.state.body as unknown as DefaultGridLayoutManager;
      expect(body.getVizPanels()).toHaveLength(0);
    });

    it('returns error for non-existent element', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const result = await client.execute({
        type: 'REMOVE_PANEL',
        payload: { elements: [{ name: 'nonexistent' }] },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns partial success when some elements fail', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const validName = await addPanel(client, 'Real Panel');

      const result = await client.execute({
        type: 'REMOVE_PANEL',
        payload: { elements: [{ name: validName }, { name: 'nonexistent' }] },
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      const data = result.data as { removed: string[] };
      expect(data.removed).toHaveLength(1);
      expect(data.removed[0]).toBe(validName);
    });
  });

  describe('MOVE_PANEL', () => {
    let originalToggle: boolean | undefined;

    beforeEach(() => {
      originalToggle = config.featureToggles.dashboardNewLayouts;
      config.featureToggles.dashboardNewLayouts = true;
    });

    afterEach(() => {
      config.featureToggles.dashboardNewLayouts = originalToggle;
    });

    it('repositions panel within current group using layoutItem', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const elementName = await addPanel(client, 'Move Me');

      const result = await client.execute({
        type: 'MOVE_PANEL',
        payload: {
          element: { name: elementName },
          layoutItem: { spec: { x: 12, y: 0, width: 6, height: 4 } },
        },
      });

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].previousValue).toBeDefined();
      expect(result.changes[0].previousValue).not.toBeNull();
      const data = result.data as PanelElementEntry;
      expect(data.layoutItem.kind).toBe('GridLayoutItem');
      const gridSpec = data.layoutItem.spec as { x: number; width: number };
      expect(gridSpec.x).toBe(12);
      expect(gridSpec.width).toBe(6);
    });

    it('returns error for non-existent element', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const result = await client.execute({
        type: 'MOVE_PANEL',
        payload: {
          element: { name: 'nonexistent' },
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('emits deprecation warning when using position field', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const elementName = await addPanel(client, 'Deprecated Position');

      const result = await client.execute({
        type: 'MOVE_PANEL',
        payload: {
          element: { name: elementName },
          position: { x: 0, y: 0, width: 24, height: 10 },
        },
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings![0]).toContain('DEPRECATED');
    });
  });
});
