/**
 * Integration tests for mutation routing through DashboardMutationClient.execute().
 *
 * These tests verify the full pipeline: command lookup -> permission check -> validation -> handler -> result.
 * Rather than testing individual command handlers, they exercise the client's execute() method directly.
 */

import { sceneGraph, VizPanel } from '@grafana/scenes';

import { getUpdatedHoverHeader } from '../../panel-edit/getPanelFrameOptions';
import type { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { DashboardMutationClient } from '../DashboardMutationClient';
import type { MutationResult } from '../types';

// --- Mocks (same patterns as panelCommands.test.ts) ---

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

// --- Helpers ---

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
    title: 'Test Dashboard',
    description: 'Test Description',
    tags: ['test'],
    body,
  };

  const scene = {
    state,
    serializer: mockSerializer(elementMap),
    canEditDashboard: jest.fn(() => true),
    onEnterEditMode: jest.fn(() => {
      state.isEditing = true;
    }),
    forceRender: jest.fn(),
    setState: jest.fn((partial: Record<string, unknown>) => {
      Object.assign(state, partial);
    }),
    updatePanelTitle: jest.fn((panel: VizPanel, title: string) => {
      panel.setState({ title, hoverHeader: getUpdatedHoverHeader(title, panel.state.$timeRange) });
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

async function addPanel(client: DashboardMutationClient, title: string, pluginId?: string) {
  const result = await client.execute({
    type: 'ADD_PANEL',
    payload: { panel: makePanelPayload(title, pluginId) },
  });
  if (!result.success) {
    throw new Error(`ADD_PANEL failed: ${result.error}`);
  }
  return getElementName(result.data);
}

// --- Tests ---

describe('Mutation routing through DashboardMutationClient.execute()', () => {
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

  describe('UPDATE_PANEL options change', () => {
    it('routes options payload through the full pipeline and updates panel options', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const elementName = await addPanel(client, 'Options Panel');

      // Set initial options on the panel
      const body = scene.state.body as unknown as DefaultGridLayoutManager;
      const vizPanel = body.getVizPanels()[0];
      vizPanel.onOptionsChange({ showLines: true, lineWidth: 2 }, true);

      const result: MutationResult = await client.execute({
        type: 'UPDATE_PANEL',
        payload: {
          element: { name: elementName },
          panel: {
            kind: 'Panel',
            spec: {
              vizConfig: {
                kind: 'VizConfig',
                spec: { options: { showLines: false, pointSize: 5 } },
              },
            },
          },
        },
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opts = vizPanel.state.options as Record<string, any>;
      expect(opts.showLines).toBe(false);
      expect(opts.pointSize).toBe(5);
      // Existing key should be preserved via deep merge
      expect(opts.lineWidth).toBe(2);
    });
  });

  describe('UPDATE_PANEL fieldConfig change', () => {
    it('routes fieldConfig payload through the full pipeline and updates field config', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const elementName = await addPanel(client, 'FieldConfig Panel');

      const result: MutationResult = await client.execute({
        type: 'UPDATE_PANEL',
        payload: {
          element: { name: elementName },
          panel: {
            kind: 'Panel',
            spec: {
              vizConfig: {
                kind: 'VizConfig',
                spec: {
                  fieldConfig: {
                    defaults: { unit: 'bytes', min: 0 },
                    overrides: [],
                  },
                },
              },
            },
          },
        },
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      const body = scene.state.body as unknown as DefaultGridLayoutManager;
      const vizPanel = body.getVizPanels()[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fc = vizPanel.state.fieldConfig as Record<string, any>;
      expect(fc.defaults.unit).toBe('bytes');
      expect(fc.defaults.min).toBe(0);
    });
  });

  describe('UPDATE_DASHBOARD_INFO via client', () => {
    it('routes title and tags change through the full pipeline', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const result: MutationResult = await client.execute({
        type: 'UPDATE_DASHBOARD_INFO',
        payload: {
          title: 'Updated Title',
          tags: ['updated', 'routing-test'],
        },
      });

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(2);
      expect(result.changes[0]).toEqual({
        path: 'title',
        previousValue: 'Test Dashboard',
        newValue: 'Updated Title',
      });
      expect(result.changes[1]).toEqual({
        path: 'tags',
        previousValue: ['test'],
        newValue: ['updated', 'routing-test'],
      });
      expect(scene.state.title).toBe('Updated Title');
      expect(scene.state.tags).toEqual(['updated', 'routing-test']);
    });

    it('enters edit mode as part of the routing pipeline', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      expect(scene.state.isEditing).toBe(false);

      await client.execute({
        type: 'UPDATE_DASHBOARD_INFO',
        payload: { description: 'Triggers edit mode' },
      });

      expect((scene as unknown as { onEnterEditMode: jest.Mock }).onEnterEditMode).toHaveBeenCalled();
      expect(scene.state.isEditing).toBe(true);
    });
  });

  describe('Unknown command returns error', () => {
    it('returns success: false with descriptive error for bogus command type', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const result: MutationResult = await client.execute({
        type: 'TOTALLY_BOGUS_COMMAND',
        payload: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown command type');
      expect(result.error).toContain('TOTALLY_BOGUS_COMMAND');
      expect(result.changes).toEqual([]);
    });
  });

  describe('Validation failure returns error', () => {
    it('returns success: false when UPDATE_DASHBOARD_INFO title is not a string', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const result: MutationResult = await client.execute({
        type: 'UPDATE_DASHBOARD_INFO',
        payload: { title: 12345 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
      expect(result.changes).toEqual([]);
      // State should remain unchanged
      expect(scene.state.title).toBe('Test Dashboard');
    });

    it('returns success: false when UPDATE_DASHBOARD_INFO tags is not an array', async () => {
      const scene = buildPanelScene();
      const client = new DashboardMutationClient(scene);

      const result: MutationResult = await client.execute({
        type: 'UPDATE_DASHBOARD_INFO',
        payload: { tags: 'not-an-array' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
      expect(result.changes).toEqual([]);
    });
  });
});
