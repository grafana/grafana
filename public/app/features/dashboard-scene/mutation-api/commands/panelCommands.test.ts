import { config } from '@grafana/runtime';
import { sceneGraph, VizPanel } from '@grafana/scenes';

import { getUpdatedHoverHeader } from '../../panel-edit/getPanelFrameOptions';
import type { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
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

describe('Panel mutation commands', () => {
  beforeEach(() => {
    jest.spyOn(sceneGraph, 'getTimeRange').mockReturnValue({
      onRefresh: jest.fn(),
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
      expect(data.layoutItem.spec.x).toBe(6);
      expect(data.layoutItem.spec.y).toBe(3);
      expect(data.layoutItem.spec.width).toBe(8);
      expect(data.layoutItem.spec.height).toBe(5);
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
      expect(data.layoutItem.spec.x).toBe(12);
      expect(data.layoutItem.spec.width).toBe(6);
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
