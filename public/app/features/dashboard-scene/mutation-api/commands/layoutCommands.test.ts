import { config } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import type { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { DashboardMutationClient } from '../DashboardMutationClient';
import type { MutationResult } from '../types';

// Mock the edit-pane actions so that perform() is called synchronously
// instead of publishing an event (which requires a DashboardScene subscriber).
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

jest.mock('../../utils/utils', () => {
  const actual = jest.requireActual('../../utils/utils');
  return {
    ...actual,
    getDashboardSceneFor: jest.fn(() => ({
      state: { isEditing: true },
    })),
  };
});

function mockSerializer(elementMap: Record<string, number> = {}) {
  const reverseMap: Record<number, string> = {};
  for (const [name, id] of Object.entries(elementMap)) {
    reverseMap[id] = name;
  }
  return {
    getPanelIdForElement: jest.fn((name: string) => elementMap[name]),
    getElementIdForPanel: jest.fn((id: number) => reverseMap[id]),
    getDSReferencesMapping: jest.fn(() => ({})),
  };
}

function buildRowsScene(rowTitles: string[] = ['Row A', 'Row B']): DashboardScene {
  const rows = rowTitles.map(
    (title) =>
      new RowItem({
        title,
        layout: DefaultGridLayoutManager.fromVizPanels([]),
      })
  );

  const body = new RowsLayoutManager({ rows });

  const state: Record<string, unknown> = {
    uid: 'test-dash',
    isEditing: false,
    body,
  };

  const scene = {
    state,
    serializer: mockSerializer(),
    canEditDashboard: jest.fn(() => true),
    onEnterEditMode: jest.fn(() => {
      state.isEditing = true;
    }),
    forceRender: jest.fn(),
    setState: jest.fn((partial: Record<string, unknown>) => {
      Object.assign(state, partial);
    }),
  };

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return scene as unknown as DashboardScene;
}

function buildTabsScene(tabTitles: string[] = ['Tab A', 'Tab B']): DashboardScene {
  const tabs = tabTitles.map(
    (title) =>
      new TabItem({
        title,
        layout: DefaultGridLayoutManager.fromVizPanels([]),
      })
  );

  const body = new TabsLayoutManager({ tabs });

  const state: Record<string, unknown> = {
    uid: 'test-dash',
    isEditing: false,
    body,
  };

  const scene = {
    state,
    serializer: mockSerializer(),
    canEditDashboard: jest.fn(() => true),
    onEnterEditMode: jest.fn(() => {
      state.isEditing = true;
    }),
    forceRender: jest.fn(),
    setState: jest.fn((partial: Record<string, unknown>) => {
      Object.assign(state, partial);
    }),
  };

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return scene as unknown as DashboardScene;
}

function buildRowsSceneWithPanels(): DashboardScene {
  const panelA = new VizPanel({ key: 'panel-1', title: 'Panel A', pluginId: 'timeseries' });
  const panelB = new VizPanel({ key: 'panel-2', title: 'Panel B', pluginId: 'timeseries' });

  const row1 = new RowItem({
    title: 'Row 1',
    layout: DefaultGridLayoutManager.fromVizPanels([panelA]),
  });
  const row2 = new RowItem({
    title: 'Row 2',
    layout: DefaultGridLayoutManager.fromVizPanels([panelB]),
  });

  const body = new RowsLayoutManager({ rows: [row1, row2] });

  const state: Record<string, unknown> = {
    uid: 'test-dash',
    isEditing: false,
    body,
  };

  const scene = {
    state,
    serializer: mockSerializer({ 'elem-a': 1, 'elem-b': 2 }),
    canEditDashboard: jest.fn(() => true),
    onEnterEditMode: jest.fn(() => {
      state.isEditing = true;
    }),
    forceRender: jest.fn(),
    setState: jest.fn((partial: Record<string, unknown>) => {
      Object.assign(state, partial);
    }),
  };

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return scene as unknown as DashboardScene;
}

/**
 * Builds a scene with a LayoutParent mock on the body, enabling
 * layout conversion tests (e.g., grid -> tabs, rows -> tabs).
 */
function buildSceneWithLayoutParent(
  body: DefaultGridLayoutManager | RowsLayoutManager | TabsLayoutManager | AutoGridLayoutManager,
  serializer = mockSerializer()
): DashboardScene {
  const state: Record<string, unknown> = {
    uid: 'test-dash',
    isEditing: false,
    body,
  };

  const mockLayoutParent = {
    switchLayout: jest.fn((newLayout: unknown) => {
      state.body = newLayout;
    }),
    publishEvent: jest.fn(),
  };

  (body as unknown as { _parent: unknown })._parent = mockLayoutParent;

  const scene = {
    state,
    serializer,
    canEditDashboard: jest.fn(() => true),
    onEnterEditMode: jest.fn(() => {
      state.isEditing = true;
    }),
    forceRender: jest.fn(),
    setState: jest.fn((partial: Record<string, unknown>) => {
      Object.assign(state, partial);
    }),
  };

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return scene as unknown as DashboardScene;
}

describe('Layout mutation commands', () => {
  let originalToggle: boolean | undefined;

  beforeEach(() => {
    originalToggle = config.featureToggles.dashboardNewLayouts;
    config.featureToggles.dashboardNewLayouts = true;
  });

  afterEach(() => {
    config.featureToggles.dashboardNewLayouts = originalToggle;
  });

  describe('ADD_ROW', () => {
    it('adds a row to a RowsLayout', async () => {
      const scene = buildRowsScene(['Existing']);
      const executor = new DashboardMutationClient(scene);

      const result: MutationResult = await executor.execute({
        type: 'ADD_ROW',
        payload: {
          row: { kind: 'RowsLayoutRow', spec: { title: 'New Row' } },
          parentPath: '/',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ path: '/rows/1' });

      const body = scene.state.body as unknown as RowsLayoutManager;
      expect(body.state.rows).toHaveLength(2);
      expect(body.state.rows[1].state.title).toBe('New Row');
    });

    it('inserts a row at a specific position', async () => {
      const scene = buildRowsScene(['First', 'Third']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'ADD_ROW',
        payload: {
          row: { kind: 'RowsLayoutRow', spec: { title: 'Second' } },
          parentPath: '/',
          position: 1,
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as RowsLayoutManager;
      expect(body.state.rows.map((r) => r.state.title)).toEqual(['First', 'Second', 'Third']);
    });
  });

  describe('REMOVE_ROW', () => {
    it('removes a row by path', async () => {
      const scene = buildRowsScene(['A', 'B', 'C']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'REMOVE_ROW',
        payload: { path: '/rows/1' },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as RowsLayoutManager;
      expect(body.state.rows).toHaveLength(2);
      expect(body.state.rows.map((r) => r.state.title)).toEqual(['A', 'C']);
    });

    it('fails for invalid path', async () => {
      const scene = buildRowsScene(['A']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'REMOVE_ROW',
        payload: { path: '/rows/5' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('out of bounds');
    });

    it('fails when moveContentTo is the same path as the row being removed', async () => {
      const scene = buildRowsScene(['A', 'B']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'REMOVE_ROW',
        payload: { path: '/rows/0', moveContentTo: '/rows/0' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('same path');
    });
  });

  describe('UPDATE_ROW', () => {
    it('updates row title', async () => {
      const scene = buildRowsScene(['Old Title']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_ROW',
        payload: {
          path: '/rows/0',
          spec: { title: 'New Title' },
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as RowsLayoutManager;
      expect(body.state.rows[0].state.title).toBe('New Title');
    });

    it('updates row collapse state', async () => {
      const scene = buildRowsScene(['Row']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_ROW',
        payload: {
          path: '/rows/0',
          spec: { collapse: true },
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as RowsLayoutManager;
      expect(body.state.rows[0].state.collapse).toBe(true);
    });
  });

  describe('MOVE_ROW', () => {
    it('reorders a row within the same parent', async () => {
      const scene = buildRowsScene(['A', 'B', 'C']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'MOVE_ROW',
        payload: {
          path: '/rows/0',
          toPosition: 2,
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as RowsLayoutManager;
      expect(body.state.rows.map((r) => r.state.title)).toEqual(['B', 'C', 'A']);
    });

    it('moves a row to the end when toPosition is omitted', async () => {
      const scene = buildRowsScene(['A', 'B', 'C']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'MOVE_ROW',
        payload: { path: '/rows/0' },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as RowsLayoutManager;
      expect(body.state.rows.map((r) => r.state.title)).toEqual(['B', 'C', 'A']);
    });
  });

  describe('ADD_TAB', () => {
    it('adds a tab to a TabsLayout', async () => {
      const scene = buildTabsScene(['Existing']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'ADD_TAB',
        payload: {
          tab: { kind: 'TabsLayoutTab', spec: { title: 'New Tab' } },
          parentPath: '/',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ path: '/tabs/1' });

      const body = scene.state.body as unknown as TabsLayoutManager;
      expect(body.state.tabs).toHaveLength(2);
      expect(body.state.tabs[1].state.title).toBe('New Tab');
    });

    it('inserts a tab at a specific position', async () => {
      const scene = buildTabsScene(['First', 'Third']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'ADD_TAB',
        payload: {
          tab: { kind: 'TabsLayoutTab', spec: { title: 'Second' } },
          parentPath: '/',
          position: 1,
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as TabsLayoutManager;
      expect(body.state.tabs.map((t) => t.state.title)).toEqual(['First', 'Second', 'Third']);
    });
  });

  describe('REMOVE_TAB', () => {
    it('removes a tab by path', async () => {
      const scene = buildTabsScene(['A', 'B', 'C']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'REMOVE_TAB',
        payload: { path: '/tabs/1' },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as TabsLayoutManager;
      expect(body.state.tabs).toHaveLength(2);
      expect(body.state.tabs.map((t) => t.state.title)).toEqual(['A', 'C']);
    });

    it('fails for invalid path', async () => {
      const scene = buildTabsScene(['A']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'REMOVE_TAB',
        payload: { path: '/tabs/5' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('out of bounds');
    });

    it('fails when moveContentTo is the same path as the tab being removed', async () => {
      const scene = buildTabsScene(['A', 'B']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'REMOVE_TAB',
        payload: { path: '/tabs/0', moveContentTo: '/tabs/0' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('same path');
    });
  });

  describe('UPDATE_TAB', () => {
    it('updates tab title', async () => {
      const scene = buildTabsScene(['Old Title']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_TAB',
        payload: {
          path: '/tabs/0',
          spec: { title: 'New Title' },
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as TabsLayoutManager;
      expect(body.state.tabs[0].state.title).toBe('New Title');
    });
  });

  describe('MOVE_TAB', () => {
    it('reorders a tab within the same parent', async () => {
      const scene = buildTabsScene(['A', 'B', 'C']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'MOVE_TAB',
        payload: {
          path: '/tabs/0',
          toPosition: 2,
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as TabsLayoutManager;
      expect(body.state.tabs.map((t) => t.state.title)).toEqual(['B', 'C', 'A']);
    });

    it('moves a tab to the end when toPosition is omitted', async () => {
      const scene = buildTabsScene(['A', 'B', 'C']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'MOVE_TAB',
        payload: { path: '/tabs/0' },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as TabsLayoutManager;
      expect(body.state.tabs.map((t) => t.state.title)).toEqual(['B', 'C', 'A']);
    });
  });

  describe('GET_LAYOUT', () => {
    it('returns RowsLayout with path annotations on rows', async () => {
      const scene = buildRowsScene(['Alpha', 'Beta']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({ type: 'GET_LAYOUT', payload: {} });

      expect(result.success).toBe(true);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      const data = result.data as { layout: any; elements: Record<string, unknown> };
      expect(data.layout.kind).toBe('RowsLayout');
      expect(data.layout.spec.rows).toHaveLength(2);
      expect(data.layout.spec.rows[0].path).toBe('/rows/0');
      expect(data.layout.spec.rows[1].path).toBe('/rows/1');
    });

    it('returns TabsLayout with path annotations on tabs', async () => {
      const scene = buildTabsScene(['Tab X', 'Tab Y']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({ type: 'GET_LAYOUT', payload: {} });

      expect(result.success).toBe(true);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      const data = result.data as { layout: any; elements: Record<string, unknown> };
      expect(data.layout.kind).toBe('TabsLayout');
      expect(data.layout.spec.tabs).toHaveLength(2);
      expect(data.layout.spec.tabs[0].path).toBe('/tabs/0');
      expect(data.layout.spec.tabs[1].path).toBe('/tabs/1');
    });

    it('returns empty elements for layouts with no panels', async () => {
      const scene = buildRowsScene(['Empty Row']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({ type: 'GET_LAYOUT', payload: {} });

      expect(result.success).toBe(true);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      const data = result.data as { layout: any; elements: Record<string, unknown> };
      expect(data.elements).toEqual({});
    });

    it('is rejected when feature toggle is disabled', async () => {
      config.featureToggles.dashboardNewLayouts = false;
      const scene = buildRowsScene(['Row']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({ type: 'GET_LAYOUT', payload: {} });

      expect(result.success).toBe(false);
      expect(result.error).toContain('dashboardNewLayouts');
    });
  });

  describe('MOVE_PANEL', () => {
    it('moves a panel from one row to another', async () => {
      const scene = buildRowsSceneWithPanels();
      const executor = new DashboardMutationClient(scene);
      const body = scene.state.body as unknown as RowsLayoutManager;

      // Row 1 has panel-1, Row 2 has panel-2
      expect(body.state.rows[0].state.layout.getVizPanels()).toHaveLength(1);
      expect(body.state.rows[1].state.layout.getVizPanels()).toHaveLength(1);

      const result = await executor.execute({
        type: 'MOVE_PANEL',
        payload: {
          element: { name: 'elem-a' },
          toParent: '/rows/1',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ element: 'elem-a', parent: '/rows/1' });

      // Panel moved from Row 1 to Row 2
      expect(body.state.rows[0].state.layout.getVizPanels()).toHaveLength(0);
      expect(body.state.rows[1].state.layout.getVizPanels()).toHaveLength(2);
    });

    it('returns no-op when toParent is omitted and no position is provided', async () => {
      const scene = buildRowsSceneWithPanels();
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'MOVE_PANEL',
        payload: {
          element: { name: 'elem-a' },
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ element: 'elem-a', parent: 'current' });
      expect(result.warnings).toBeUndefined();
    });

    it('repositions a panel within the same group when position is provided', async () => {
      const scene = buildRowsSceneWithPanels();
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'MOVE_PANEL',
        payload: {
          element: { name: 'elem-a' },
          position: { x: 6, y: 10, width: 12, height: 8 },
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ element: 'elem-a', parent: 'current' });
      expect(result.changes).toHaveLength(1);

      // Verify the grid item was repositioned
      const body = scene.state.body as unknown as RowsLayoutManager;
      const panels = body.state.rows[0].state.layout.getVizPanels();
      expect(panels).toHaveLength(1);
      const gridItem = panels[0].parent as unknown as {
        state: { x: number; y: number; width: number; height: number };
      };
      expect(gridItem.state.x).toBe(6);
      expect(gridItem.state.y).toBe(10);
      expect(gridItem.state.width).toBe(12);
      expect(gridItem.state.height).toBe(8);
    });

    it('preserves original panel dimensions when moving between rows', async () => {
      const scene = buildRowsSceneWithPanels();
      const executor = new DashboardMutationClient(scene);
      const body = scene.state.body as unknown as RowsLayoutManager;

      // Set custom dimensions on panel A (e.g. a full-width log panel)
      const panelA = body.state.rows[0].state.layout.getVizPanels()[0];
      const sourceGridItem = panelA.parent as unknown as {
        state: { x: number; y: number; width: number; height: number };
        setState: (s: Record<string, number>) => void;
      };
      sourceGridItem.setState({ width: 24, height: 20 });

      const result = await executor.execute({
        type: 'MOVE_PANEL',
        payload: {
          element: { name: 'elem-a' },
          toParent: '/rows/1',
        },
      });

      expect(result.success).toBe(true);

      const movedPanels = body.state.rows[1].state.layout.getVizPanels();
      expect(movedPanels).toHaveLength(2);

      const movedPanel = movedPanels.find((p) => p.state.title === 'Panel A')!;
      const newGridItem = movedPanel.parent as unknown as {
        state: { width: number; height: number };
      };
      expect(newGridItem.state.width).toBe(24);
      expect(newGridItem.state.height).toBe(20);
    });

    it('fails when element is not found', async () => {
      const scene = buildRowsSceneWithPanels();
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'MOVE_PANEL',
        payload: {
          element: { name: 'nonexistent' },
          toParent: '/rows/1',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('fails when target path is invalid', async () => {
      const scene = buildRowsSceneWithPanels();
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'MOVE_PANEL',
        payload: {
          element: { name: 'elem-a' },
          toParent: '/rows/99',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('out of bounds');
    });

    it('moves a panel from DefaultGridLayout row to AutoGridLayout row', async () => {
      const panelA = new VizPanel({ key: 'panel-1', title: 'Panel A', pluginId: 'timeseries' });

      const row1 = new RowItem({
        title: 'Grid Row',
        layout: DefaultGridLayoutManager.fromVizPanels([panelA]),
      });
      const row2 = new RowItem({
        title: 'AutoGrid Row',
        layout: AutoGridLayoutManager.createEmpty(),
      });

      const body = new RowsLayoutManager({ rows: [row1, row2] });
      const state: Record<string, unknown> = { uid: 'test-dash', isEditing: false, body };
      const scene = {
        state,
        serializer: mockSerializer({ 'elem-a': 1 }),
        canEditDashboard: jest.fn(() => true),
        onEnterEditMode: jest.fn(() => {
          state.isEditing = true;
        }),
        forceRender: jest.fn(),
        setState: jest.fn((partial: Record<string, unknown>) => {
          Object.assign(state, partial);
        }),
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      } as unknown as DashboardScene;

      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'MOVE_PANEL',
        payload: {
          element: { name: 'elem-a' },
          toParent: '/rows/1',
        },
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toBeUndefined();
      expect(body.state.rows[0].state.layout.getVizPanels()).toHaveLength(0);
      expect(body.state.rows[1].state.layout.getVizPanels()).toHaveLength(1);
    });

    it('warns when position is provided for an AutoGridLayout target', async () => {
      const panelA = new VizPanel({ key: 'panel-1', title: 'Panel A', pluginId: 'timeseries' });

      const row1 = new RowItem({
        title: 'Grid Row',
        layout: DefaultGridLayoutManager.fromVizPanels([panelA]),
      });
      const row2 = new RowItem({
        title: 'AutoGrid Row',
        layout: AutoGridLayoutManager.createEmpty(),
      });

      const body = new RowsLayoutManager({ rows: [row1, row2] });
      const state: Record<string, unknown> = { uid: 'test-dash', isEditing: false, body };
      const scene = {
        state,
        serializer: mockSerializer({ 'elem-a': 1 }),
        canEditDashboard: jest.fn(() => true),
        onEnterEditMode: jest.fn(() => {
          state.isEditing = true;
        }),
        forceRender: jest.fn(),
        setState: jest.fn((partial: Record<string, unknown>) => {
          Object.assign(state, partial);
        }),
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      } as unknown as DashboardScene;

      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'MOVE_PANEL',
        payload: {
          element: { name: 'elem-a' },
          toParent: '/rows/1',
          position: { x: 0, y: 0, width: 12, height: 8 },
        },
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Position ignored: target uses AutoGridLayout which auto-arranges panels.');
      expect(body.state.rows[1].state.layout.getVizPanels()).toHaveLength(1);
    });
  });

  describe('nested layout operations', () => {
    it('adds a row inside a tab', async () => {
      const innerRows = new RowsLayoutManager({
        rows: [new RowItem({ title: 'Inner Row', layout: DefaultGridLayoutManager.fromVizPanels([]) })],
      });
      const tabs = [
        new TabItem({ title: 'Tab With Rows', layout: innerRows }),
        new TabItem({ title: 'Other Tab', layout: DefaultGridLayoutManager.fromVizPanels([]) }),
      ];
      const body = new TabsLayoutManager({ tabs });
      const state: Record<string, unknown> = { uid: 'test', isEditing: false, body };
      const scene = {
        state,
        serializer: mockSerializer(),
        canEditDashboard: jest.fn(() => true),
        onEnterEditMode: jest.fn(() => {
          state.isEditing = true;
        }),
        forceRender: jest.fn(),
        setState: jest.fn((partial: Record<string, unknown>) => {
          Object.assign(state, partial);
        }),
      } as unknown as DashboardScene;

      const executor = new DashboardMutationClient(scene);
      const result = await executor.execute({
        type: 'ADD_ROW',
        payload: {
          row: { kind: 'RowsLayoutRow', spec: { title: 'New Nested Row' } },
          parentPath: '/tabs/0',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ path: '/tabs/0/rows/1' });

      const tabBody = body.state.tabs[0].state.layout as RowsLayoutManager;
      expect(tabBody.state.rows).toHaveLength(2);
      expect(tabBody.state.rows[1].state.title).toBe('New Nested Row');
    });

    it('moves a row between tabs via cross-parent MOVE_ROW', async () => {
      // Suppress expected SceneObject parent warning when re-parenting a row
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const tab0Rows = new RowsLayoutManager({
        rows: [
          new RowItem({ title: 'Row A', layout: DefaultGridLayoutManager.fromVizPanels([]) }),
          new RowItem({ title: 'Row B', layout: DefaultGridLayoutManager.fromVizPanels([]) }),
        ],
      });
      const tab1Rows = new RowsLayoutManager({
        rows: [new RowItem({ title: 'Row C', layout: DefaultGridLayoutManager.fromVizPanels([]) })],
      });
      const body = new TabsLayoutManager({
        tabs: [new TabItem({ title: 'Tab 0', layout: tab0Rows }), new TabItem({ title: 'Tab 1', layout: tab1Rows })],
      });
      const state: Record<string, unknown> = { uid: 'test', isEditing: false, body };
      const scene = {
        state,
        serializer: mockSerializer(),
        canEditDashboard: jest.fn(() => true),
        onEnterEditMode: jest.fn(() => {
          state.isEditing = true;
        }),
        forceRender: jest.fn(),
        setState: jest.fn((partial: Record<string, unknown>) => {
          Object.assign(state, partial);
        }),
      } as unknown as DashboardScene;

      const executor = new DashboardMutationClient(scene);
      const result = await executor.execute({
        type: 'MOVE_ROW',
        payload: {
          path: '/tabs/0/rows/0',
          toParent: '/tabs/1',
          toPosition: 0,
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ path: '/tabs/1/rows/0' });

      const t0Rows = (body.state.tabs[0].state.layout as RowsLayoutManager).state.rows;
      const t1Rows = (body.state.tabs[1].state.layout as RowsLayoutManager).state.rows;
      expect(t0Rows.map((r) => r.state.title)).toEqual(['Row B']);
      expect(t1Rows.map((r) => r.state.title)).toEqual(['Row A', 'Row C']);

      warnSpy.mockRestore();
    });
  });

  describe('layout conversion', () => {
    // Layout conversion (GridLayout -> RowsLayout/TabsLayout) requires a full LayoutParent
    // (i.e., DashboardScene with switchLayout). These tests verify the error handling
    // when the LayoutParent isn't available.

    it('returns error when adding a row to a GridLayout without a LayoutParent', async () => {
      const body = DefaultGridLayoutManager.fromVizPanels([]);
      const state: Record<string, unknown> = { uid: 'test', isEditing: false, body };
      const scene = {
        state,
        serializer: mockSerializer(),
        canEditDashboard: jest.fn(() => true),
        onEnterEditMode: jest.fn(() => {
          state.isEditing = true;
        }),
        forceRender: jest.fn(),
        setState: jest.fn((partial: Record<string, unknown>) => {
          Object.assign(state, partial);
        }),
      } as unknown as DashboardScene;

      const executor = new DashboardMutationClient(scene);
      const result = await executor.execute({
        type: 'ADD_ROW',
        payload: {
          row: { kind: 'RowsLayoutRow', spec: { title: 'First Row' } },
          parentPath: '/',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('converts grid to tabs with only the requested tab (no extra "New tab")', async () => {
      const panelA = new VizPanel({ key: 'panel-1', title: 'Panel A', pluginId: 'timeseries' });
      const scene = buildSceneWithLayoutParent(DefaultGridLayoutManager.fromVizPanels([panelA]));
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'ADD_TAB',
        payload: {
          tab: { kind: 'TabsLayoutTab', spec: { title: 'Monitoring' } },
          parentPath: '/',
        },
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();

      const body = scene.state.body as unknown as TabsLayoutManager;
      expect(body).toBeInstanceOf(TabsLayoutManager);
      expect(body.state.tabs).toHaveLength(1);
      expect(body.state.tabs[0].state.title).toBe('Monitoring');

      // Existing panel should be inside the new tab
      const tabPanels = body.state.tabs[0].getLayout().getVizPanels();
      expect(tabPanels).toHaveLength(1);
      expect(tabPanels[0].state.title).toBe('Panel A');
    });

    it('converts grid to tabs with empty grid - single tab only', async () => {
      const scene = buildSceneWithLayoutParent(DefaultGridLayoutManager.fromVizPanels([]));
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'ADD_TAB',
        payload: {
          tab: { kind: 'TabsLayoutTab', spec: { title: 'Overview' } },
          parentPath: '/',
        },
      });

      expect(result.success).toBe(true);

      const body = scene.state.body as unknown as TabsLayoutManager;
      expect(body).toBeInstanceOf(TabsLayoutManager);
      expect(body.state.tabs).toHaveLength(1);
      expect(body.state.tabs[0].state.title).toBe('Overview');
    });

    it('converts rows to tabs by nesting rows inside the requested tab', async () => {
      const row1 = new RowItem({
        title: 'Row 1',
        layout: DefaultGridLayoutManager.fromVizPanels([
          new VizPanel({ key: 'panel-1', title: 'Panel A', pluginId: 'timeseries' }),
        ]),
      });
      const row2 = new RowItem({
        title: 'Row 2',
        layout: DefaultGridLayoutManager.fromVizPanels([]),
      });
      const rowsBody = new RowsLayoutManager({ rows: [row1, row2] });
      const scene = buildSceneWithLayoutParent(rowsBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'ADD_TAB',
        payload: {
          tab: { kind: 'TabsLayoutTab', spec: { title: 'Main' } },
          parentPath: '/',
        },
      });

      expect(result.success).toBe(true);

      const body = scene.state.body as unknown as TabsLayoutManager;
      expect(body).toBeInstanceOf(TabsLayoutManager);
      expect(body.state.tabs).toHaveLength(1);
      expect(body.state.tabs[0].state.title).toBe('Main');

      // The rows layout should be preserved inside the tab
      const innerLayout = body.state.tabs[0].getLayout();
      expect(innerLayout).toBeInstanceOf(RowsLayoutManager);
      expect((innerLayout as RowsLayoutManager).state.rows).toHaveLength(2);
    });

    it('converts tabs to rows by nesting tabs inside the requested row', async () => {
      const tab1 = new TabItem({
        title: 'Tab 1',
        layout: DefaultGridLayoutManager.fromVizPanels([
          new VizPanel({ key: 'panel-1', title: 'Panel A', pluginId: 'timeseries' }),
        ]),
      });
      const tab2 = new TabItem({
        title: 'Tab 2',
        layout: DefaultGridLayoutManager.fromVizPanels([]),
      });
      const tabsBody = new TabsLayoutManager({ tabs: [tab1, tab2] });
      const scene = buildSceneWithLayoutParent(tabsBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'ADD_ROW',
        payload: {
          row: { kind: 'RowsLayoutRow', spec: { title: 'Main Row' } },
          parentPath: '/',
        },
      });

      expect(result.success).toBe(true);

      const body = scene.state.body as unknown as RowsLayoutManager;
      expect(body).toBeInstanceOf(RowsLayoutManager);
      expect(body.state.rows).toHaveLength(1);
      expect(body.state.rows[0].state.title).toBe('Main Row');

      // The tabs layout should be preserved inside the row
      const innerLayout = body.state.rows[0].state.layout;
      expect(innerLayout).toBeInstanceOf(TabsLayoutManager);
      expect((innerLayout as TabsLayoutManager).state.tabs).toHaveLength(2);
    });

    it('converts grid to rows by nesting grid inside the requested row', async () => {
      const panelA = new VizPanel({ key: 'panel-1', title: 'Panel A', pluginId: 'timeseries' });
      const scene = buildSceneWithLayoutParent(DefaultGridLayoutManager.fromVizPanels([panelA]));
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'ADD_ROW',
        payload: {
          row: { kind: 'RowsLayoutRow', spec: { title: 'First Row' } },
          parentPath: '/',
        },
      });

      expect(result.success).toBe(true);

      const body = scene.state.body as unknown as RowsLayoutManager;
      expect(body).toBeInstanceOf(RowsLayoutManager);
      expect(body.state.rows).toHaveLength(1);
      expect(body.state.rows[0].state.title).toBe('First Row');

      // The grid layout should be preserved inside the row
      const innerLayout = body.state.rows[0].state.layout;
      expect(innerLayout).toBeInstanceOf(DefaultGridLayoutManager);
      expect(innerLayout.getVizPanels()).toHaveLength(1);
      expect(innerLayout.getVizPanels()[0].state.title).toBe('Panel A');
    });

    it('returns error when adding a tab to a GridLayout without a LayoutParent', async () => {
      const body = DefaultGridLayoutManager.fromVizPanels([]);
      const state: Record<string, unknown> = { uid: 'test', isEditing: false, body };
      const scene = {
        state,
        serializer: mockSerializer(),
        canEditDashboard: jest.fn(() => true),
        onEnterEditMode: jest.fn(() => {
          state.isEditing = true;
        }),
        forceRender: jest.fn(),
        setState: jest.fn((partial: Record<string, unknown>) => {
          Object.assign(state, partial);
        }),
      } as unknown as DashboardScene;

      const executor = new DashboardMutationClient(scene);
      const result = await executor.execute({
        type: 'ADD_TAB',
        payload: {
          tab: { kind: 'TabsLayoutTab', spec: { title: 'First Tab' } },
          parentPath: '/',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('nesting validation', () => {
    it('rejects adding tabs inside tabs', async () => {
      const innerTabs = new TabsLayoutManager({
        tabs: [new TabItem({ title: 'Inner Tab', layout: DefaultGridLayoutManager.fromVizPanels([]) })],
      });
      const outerTabs = new TabsLayoutManager({
        tabs: [new TabItem({ title: 'Outer Tab', layout: innerTabs })],
      });
      const scene = buildSceneWithLayoutParent(outerTabs);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'ADD_TAB',
        payload: {
          tab: { kind: 'TabsLayoutTab', spec: { title: 'Bad Tab' } },
          parentPath: '/tabs/0',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('same-type nesting');
    });

    it('rejects adding rows inside rows', async () => {
      const innerRows = new RowsLayoutManager({
        rows: [new RowItem({ title: 'Inner Row', layout: DefaultGridLayoutManager.fromVizPanels([]) })],
      });
      const outerRows = new RowsLayoutManager({
        rows: [new RowItem({ title: 'Outer Row', layout: innerRows })],
      });
      const scene = buildSceneWithLayoutParent(outerRows);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'ADD_ROW',
        payload: {
          row: { kind: 'RowsLayoutRow', spec: { title: 'Bad Row' } },
          parentPath: '/rows/0',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('same-type nesting');
    });

    it('rejects adding tabs at root when rows already contain tabs', async () => {
      const rowWithTabs = new RowItem({
        title: 'Row With Tabs',
        layout: new TabsLayoutManager({
          tabs: [new TabItem({ title: 'Nested Tab', layout: DefaultGridLayoutManager.fromVizPanels([]) })],
        }),
      });
      const rowsBody = new RowsLayoutManager({ rows: [rowWithTabs] });
      const scene = buildSceneWithLayoutParent(rowsBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'ADD_TAB',
        payload: {
          tab: { kind: 'TabsLayoutTab', spec: { title: 'Root Tab' } },
          parentPath: '/',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('nested groups');
    });

    it('rejects adding rows at root when tabs already contain rows', async () => {
      const tabWithRows = new TabItem({
        title: 'Tab With Rows',
        layout: new RowsLayoutManager({
          rows: [new RowItem({ title: 'Nested Row', layout: DefaultGridLayoutManager.fromVizPanels([]) })],
        }),
      });
      const tabsBody = new TabsLayoutManager({ tabs: [tabWithRows] });
      const scene = buildSceneWithLayoutParent(tabsBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'ADD_ROW',
        payload: {
          row: { kind: 'RowsLayoutRow', spec: { title: 'Root Row' } },
          parentPath: '/',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('nested groups');
    });

    it('allows adding rows inside tabs (valid 2 layers)', async () => {
      const innerRows = new RowsLayoutManager({
        rows: [new RowItem({ title: 'Existing Row', layout: DefaultGridLayoutManager.fromVizPanels([]) })],
      });
      const tabsBody = new TabsLayoutManager({
        tabs: [new TabItem({ title: 'Tab A', layout: innerRows })],
      });
      const scene = buildSceneWithLayoutParent(tabsBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'ADD_ROW',
        payload: {
          row: { kind: 'RowsLayoutRow', spec: { title: 'Nested Row' } },
          parentPath: '/tabs/0',
        },
      });

      expect(result.success).toBe(true);
      const rows = (tabsBody.state.tabs[0].state.layout as RowsLayoutManager).state.rows;
      expect(rows).toHaveLength(2);
      expect(rows[1].state.title).toBe('Nested Row');
    });

    it('allows adding tabs inside rows (valid 2 layers)', async () => {
      const innerTabs = new TabsLayoutManager({
        tabs: [new TabItem({ title: 'Existing Tab', layout: DefaultGridLayoutManager.fromVizPanels([]) })],
      });
      const rowsBody = new RowsLayoutManager({
        rows: [new RowItem({ title: 'Row A', layout: innerTabs })],
      });
      const scene = buildSceneWithLayoutParent(rowsBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'ADD_TAB',
        payload: {
          tab: { kind: 'TabsLayoutTab', spec: { title: 'Nested Tab' } },
          parentPath: '/rows/0',
        },
      });

      expect(result.success).toBe(true);
      const tabs = (rowsBody.state.rows[0].state.layout as TabsLayoutManager).state.tabs;
      expect(tabs).toHaveLength(2);
      expect(tabs[1].state.title).toBe('Nested Tab');
    });
  });

  describe('UPDATE_LAYOUT', () => {
    it('changes rows to tabs at root', async () => {
      const rowsBody = new RowsLayoutManager({
        rows: [
          new RowItem({ title: 'Row A', layout: DefaultGridLayoutManager.fromVizPanels([]) }),
          new RowItem({ title: 'Row B', layout: DefaultGridLayoutManager.fromVizPanels([]) }),
        ],
      });
      const scene = buildSceneWithLayoutParent(rowsBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_LAYOUT',
        payload: { path: '/', layoutType: 'TabsLayout' },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as TabsLayoutManager;
      expect(body).toBeInstanceOf(TabsLayoutManager);
      expect(body.state.tabs.map((t) => t.state.title)).toEqual(['Row A', 'Row B']);
    });

    it('changes tabs to rows at root', async () => {
      const tabsBody = new TabsLayoutManager({
        tabs: [
          new TabItem({ title: 'Tab A', layout: DefaultGridLayoutManager.fromVizPanels([]) }),
          new TabItem({ title: 'Tab B', layout: DefaultGridLayoutManager.fromVizPanels([]) }),
        ],
      });
      const scene = buildSceneWithLayoutParent(tabsBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_LAYOUT',
        payload: { path: '/', layoutType: 'RowsLayout' },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as RowsLayoutManager;
      expect(body).toBeInstanceOf(RowsLayoutManager);
      expect(body.state.rows.map((r) => r.state.title)).toEqual(['Tab A', 'Tab B']);
    });

    it('changes GridLayout to AutoGridLayout', async () => {
      const panelA = new VizPanel({ key: 'panel-1', title: 'Panel A', pluginId: 'timeseries' });
      const gridBody = DefaultGridLayoutManager.fromVizPanels([panelA]);
      const scene = buildSceneWithLayoutParent(gridBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_LAYOUT',
        payload: { path: '/', layoutType: 'AutoGridLayout' },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as AutoGridLayoutManager;
      expect(body).toBeInstanceOf(AutoGridLayoutManager);
      expect(body.getVizPanels()).toHaveLength(1);
      expect(body.getVizPanels()[0].state.title).toBe('Panel A');
    });

    it('applies v2beta1 AutoGridLayout options during conversion', async () => {
      const gridBody = DefaultGridLayoutManager.fromVizPanels([]);
      const scene = buildSceneWithLayoutParent(gridBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_LAYOUT',
        payload: {
          path: '/',
          layoutType: 'AutoGridLayout',
          options: { maxColumnCount: 4, columnWidthMode: 'wide', rowHeightMode: 'tall', fillScreen: true },
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as AutoGridLayoutManager;
      expect(body).toBeInstanceOf(AutoGridLayoutManager);
      expect(body.state.maxColumnCount).toBe(4);
      expect(body.state.columnWidth).toBe('wide');
      expect(body.state.rowHeight).toBe('tall');
      expect(body.state.fillScreen).toBe(true);
    });

    it('maps custom columnWidthMode with columnWidth pixel value', async () => {
      const gridBody = DefaultGridLayoutManager.fromVizPanels([]);
      const scene = buildSceneWithLayoutParent(gridBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_LAYOUT',
        payload: {
          path: '/',
          layoutType: 'AutoGridLayout',
          options: { columnWidthMode: 'custom', columnWidth: 500, rowHeightMode: 'custom', rowHeight: 300 },
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as AutoGridLayoutManager;
      expect(body.state.columnWidth).toBe(500);
      expect(body.state.rowHeight).toBe(300);
    });

    it('changes AutoGridLayout to GridLayout', async () => {
      const panelA = new VizPanel({ key: 'panel-1', title: 'Panel A', pluginId: 'timeseries' });
      const autoGridBody = AutoGridLayoutManager.createFromLayout(DefaultGridLayoutManager.fromVizPanels([panelA]));
      const scene = buildSceneWithLayoutParent(autoGridBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_LAYOUT',
        payload: { path: '/', layoutType: 'GridLayout' },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as DefaultGridLayoutManager;
      expect(body).toBeInstanceOf(DefaultGridLayoutManager);
      expect(body.getVizPanels()).toHaveLength(1);
      expect(body.getVizPanels()[0].state.title).toBe('Panel A');
    });

    it('no-op when already target type and no options', async () => {
      const rowsBody = new RowsLayoutManager({
        rows: [new RowItem({ title: 'Row A', layout: DefaultGridLayoutManager.fromVizPanels([]) })],
      });
      const scene = buildSceneWithLayoutParent(rowsBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_LAYOUT',
        payload: { path: '/', layoutType: 'RowsLayout' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({ path: '/', layoutType: 'RowsLayout' }));
      expect(result.changes).toEqual([]);
    });

    it('no-op when layoutType is omitted and no options', async () => {
      const rowsBody = new RowsLayoutManager({
        rows: [new RowItem({ title: 'Row A', layout: DefaultGridLayoutManager.fromVizPanels([]) })],
      });
      const scene = buildSceneWithLayoutParent(rowsBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_LAYOUT',
        payload: { path: '/' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({ path: '/', layoutType: 'RowsLayout' }));
      expect(result.changes).toEqual([]);
    });

    it('update-only mode: applies options to existing AutoGridLayout', async () => {
      const autoGridBody = AutoGridLayoutManager.createFromLayout(DefaultGridLayoutManager.fromVizPanels([]));
      const scene = buildSceneWithLayoutParent(autoGridBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_LAYOUT',
        payload: {
          path: '/',
          options: { maxColumnCount: 5, columnWidthMode: 'narrow', fillScreen: true },
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as AutoGridLayoutManager;
      expect(body).toBeInstanceOf(AutoGridLayoutManager);
      expect(body.state.maxColumnCount).toBe(5);
      expect(body.state.columnWidth).toBe('narrow');
      expect(body.state.fillScreen).toBe(true);
    });

    it('returns actual previousValue when updating AutoGrid options', async () => {
      const autoGridBody = AutoGridLayoutManager.createFromLayout(DefaultGridLayoutManager.fromVizPanels([]));
      autoGridBody.setState({ maxColumnCount: 3 });
      const scene = buildSceneWithLayoutParent(autoGridBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_LAYOUT',
        payload: { path: '/', options: { maxColumnCount: 6 } },
      });

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      const change = result.changes[0];
      expect(change.previousValue).not.toBe('applied');
      expect((change.previousValue as Record<string, unknown>).maxColumnCount).toBe(3);
      expect((change.newValue as Record<string, unknown>).maxColumnCount).toBe(6);
    });

    it('rejects options on non-AutoGrid layout type', async () => {
      const gridBody = DefaultGridLayoutManager.fromVizPanels([]);
      const scene = buildSceneWithLayoutParent(gridBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_LAYOUT',
        payload: {
          path: '/',
          layoutType: 'RowsLayout',
          options: { maxColumnCount: 4 },
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Options are only valid for AutoGridLayout');
    });

    it('rejects options on current RowsLayout when layoutType is omitted', async () => {
      const rowsBody = new RowsLayoutManager({
        rows: [new RowItem({ title: 'Row A', layout: DefaultGridLayoutManager.fromVizPanels([]) })],
      });
      const scene = buildSceneWithLayoutParent(rowsBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_LAYOUT',
        payload: {
          path: '/',
          options: { maxColumnCount: 4 },
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Options are only valid for AutoGridLayout');
    });

    it('rejects cross-category conversion', async () => {
      const rowsBody = new RowsLayoutManager({
        rows: [new RowItem({ title: 'Row A', layout: DefaultGridLayoutManager.fromVizPanels([]) })],
      });
      const scene = buildSceneWithLayoutParent(rowsBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_LAYOUT',
        payload: { path: '/', layoutType: 'GridLayout' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('same-category');
    });

    it('rejects conversion that would create same-type nesting via path', async () => {
      const innerTabs = new TabsLayoutManager({
        tabs: [new TabItem({ title: 'Inner Tab', layout: DefaultGridLayoutManager.fromVizPanels([]) })],
      });
      const outerRows = new RowsLayoutManager({
        rows: [new RowItem({ title: 'Outer Row', layout: innerTabs })],
      });
      const scene = buildSceneWithLayoutParent(outerRows);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_LAYOUT',
        payload: { path: '/rows/0', layoutType: 'RowsLayout' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('same-type nesting');
    });

    it('rejects conversion that would create same-type nesting via children', async () => {
      const tabsBody = new TabsLayoutManager({
        tabs: [
          new TabItem({
            title: 'Tab A',
            layout: new RowsLayoutManager({
              rows: [new RowItem({ title: 'Row Inside Tab', layout: DefaultGridLayoutManager.fromVizPanels([]) })],
            }),
          }),
          new TabItem({ title: 'Tab B', layout: DefaultGridLayoutManager.fromVizPanels([]) }),
        ],
      });
      const scene = buildSceneWithLayoutParent(tabsBody);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_LAYOUT',
        payload: { path: '/', layoutType: 'RowsLayout' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('same-type nesting');
    });
  });

  describe('moveContentTo on remove', () => {
    it('moves panels when removing a row with moveContentTo', async () => {
      const panelA = new VizPanel({ key: 'panel-1', title: 'Panel A', pluginId: 'timeseries' });
      const row1 = new RowItem({
        title: 'Row 1',
        layout: DefaultGridLayoutManager.fromVizPanels([panelA]),
      });
      const row2 = new RowItem({
        title: 'Row 2',
        layout: DefaultGridLayoutManager.fromVizPanels([]),
      });
      const body = new RowsLayoutManager({ rows: [row1, row2] });
      const state: Record<string, unknown> = { uid: 'test', isEditing: false, body };
      const scene = {
        state,
        serializer: mockSerializer(),
        canEditDashboard: jest.fn(() => true),
        onEnterEditMode: jest.fn(() => {
          state.isEditing = true;
        }),
        forceRender: jest.fn(),
        setState: jest.fn((partial: Record<string, unknown>) => {
          Object.assign(state, partial);
        }),
      } as unknown as DashboardScene;

      const executor = new DashboardMutationClient(scene);
      const result = await executor.execute({
        type: 'REMOVE_ROW',
        payload: {
          path: '/rows/0',
          moveContentTo: '/rows/1',
        },
      });

      expect(result.success).toBe(true);
      // Row 1 removed, panels should be moved to what was Row 2 (now Row 0 after removal)
      expect(body.state.rows).toHaveLength(1);
      expect(body.state.rows[0].state.title).toBe('Row 2');
      expect(body.state.rows[0].state.layout.getVizPanels()).toHaveLength(1);
    });

    it('preserves panel titles when moving via moveContentTo', async () => {
      const panelA = new VizPanel({ key: 'panel-1', title: 'CPU Usage', pluginId: 'timeseries' });
      const panelB = new VizPanel({ key: 'panel-2', title: 'Memory', pluginId: 'gauge' });
      const row1 = new RowItem({
        title: 'Source',
        layout: DefaultGridLayoutManager.fromVizPanels([panelA, panelB]),
      });
      const row2 = new RowItem({
        title: 'Target',
        layout: DefaultGridLayoutManager.fromVizPanels([]),
      });
      const body = new RowsLayoutManager({ rows: [row1, row2] });
      const state: Record<string, unknown> = { uid: 'test', isEditing: false, body };
      const scene = {
        state,
        serializer: mockSerializer(),
        canEditDashboard: jest.fn(() => true),
        onEnterEditMode: jest.fn(() => {
          state.isEditing = true;
        }),
        forceRender: jest.fn(),
        setState: jest.fn((partial: Record<string, unknown>) => {
          Object.assign(state, partial);
        }),
      } as unknown as DashboardScene;

      const executor = new DashboardMutationClient(scene);
      const result = await executor.execute({
        type: 'REMOVE_ROW',
        payload: { path: '/rows/0', moveContentTo: '/rows/1' },
      });

      expect(result.success).toBe(true);
      const movedPanels = body.state.rows[0].state.layout.getVizPanels();
      expect(movedPanels).toHaveLength(2);
      const titles = movedPanels.map((p) => p.state.title).sort();
      expect(titles).toEqual(['CPU Usage', 'Memory']);
    });

    it('moves panels from a tab with nested rows to another tab', async () => {
      const panelA = new VizPanel({ key: 'panel-1', title: 'Panel A', pluginId: 'timeseries' });
      const panelB = new VizPanel({ key: 'panel-2', title: 'Panel B', pluginId: 'stat' });

      const tab0 = new TabItem({
        title: 'Source Tab',
        layout: new RowsLayoutManager({
          rows: [
            new RowItem({ title: 'Row A', layout: DefaultGridLayoutManager.fromVizPanels([panelA]) }),
            new RowItem({ title: 'Row B', layout: DefaultGridLayoutManager.fromVizPanels([panelB]) }),
          ],
        }),
      });
      const tab1 = new TabItem({
        title: 'Target Tab',
        layout: DefaultGridLayoutManager.fromVizPanels([]),
      });
      const body = new TabsLayoutManager({ tabs: [tab0, tab1] });
      const state: Record<string, unknown> = { uid: 'test', isEditing: false, body };
      const scene = {
        state,
        serializer: mockSerializer(),
        canEditDashboard: jest.fn(() => true),
        onEnterEditMode: jest.fn(() => {
          state.isEditing = true;
        }),
        forceRender: jest.fn(),
        setState: jest.fn((partial: Record<string, unknown>) => {
          Object.assign(state, partial);
        }),
      } as unknown as DashboardScene;

      const executor = new DashboardMutationClient(scene);
      const result = await executor.execute({
        type: 'REMOVE_TAB',
        payload: { path: '/tabs/0', moveContentTo: '/tabs/1' },
      });

      expect(result.success).toBe(true);
      expect(body.state.tabs).toHaveLength(1);
      expect(body.state.tabs[0].state.title).toBe('Target Tab');
      const movedPanels = body.state.tabs[0].state.layout.getVizPanels();
      expect(movedPanels).toHaveLength(2);
      const titles = movedPanels.map((p) => p.state.title).sort();
      expect(titles).toEqual(['Panel A', 'Panel B']);
    });

    it('moves panels to a RowsLayout target (resolves to first row)', async () => {
      const panelA = new VizPanel({ key: 'panel-1', title: 'Panel A', pluginId: 'timeseries' });
      const tab0 = new TabItem({
        title: 'Source',
        layout: DefaultGridLayoutManager.fromVizPanels([panelA]),
      });
      const tab1 = new TabItem({
        title: 'Target',
        layout: new RowsLayoutManager({
          rows: [new RowItem({ title: 'Dest Row', layout: DefaultGridLayoutManager.fromVizPanels([]) })],
        }),
      });
      const body = new TabsLayoutManager({ tabs: [tab0, tab1] });
      const state: Record<string, unknown> = { uid: 'test', isEditing: false, body };
      const scene = {
        state,
        serializer: mockSerializer(),
        canEditDashboard: jest.fn(() => true),
        onEnterEditMode: jest.fn(() => {
          state.isEditing = true;
        }),
        forceRender: jest.fn(),
        setState: jest.fn((partial: Record<string, unknown>) => {
          Object.assign(state, partial);
        }),
      } as unknown as DashboardScene;

      const executor = new DashboardMutationClient(scene);
      const result = await executor.execute({
        type: 'REMOVE_TAB',
        payload: { path: '/tabs/0', moveContentTo: '/tabs/1' },
      });

      expect(result.success).toBe(true);
      const targetRows = (body.state.tabs[0].state.layout as RowsLayoutManager).state.rows;
      expect(targetRows[0].state.layout.getVizPanels()).toHaveLength(1);
      expect(targetRows[0].state.layout.getVizPanels()[0].state.title).toBe('Panel A');
    });

    it('fails when moveContentTo targets an empty RowsLayout', async () => {
      const panelA = new VizPanel({ key: 'panel-1', title: 'Panel A', pluginId: 'timeseries' });

      // moveContentTo targets "/" which is the RowsLayoutManager itself.
      // After removing /rows/0, the RowsLayout has no rows, so we can't place panels.
      // However, the move happens BEFORE the removal, so at this point rows[0] still exists.
      // Let's test with a scenario where the target is genuinely empty.
      // We'll create a tabs scene where tab1 has an empty RowsLayout.
      const emptyRowsTab = new TabItem({
        title: 'Empty',
        layout: new RowsLayoutManager({ rows: [] }),
      });
      const sourceTab = new TabItem({
        title: 'Source',
        layout: DefaultGridLayoutManager.fromVizPanels([panelA]),
      });
      const tabsBody = new TabsLayoutManager({ tabs: [sourceTab, emptyRowsTab] });
      const tabsState: Record<string, unknown> = { uid: 'test', isEditing: false, body: tabsBody };
      const tabsScene = {
        state: tabsState,
        serializer: mockSerializer(),
        canEditDashboard: jest.fn(() => true),
        onEnterEditMode: jest.fn(() => {
          tabsState.isEditing = true;
        }),
        forceRender: jest.fn(),
        setState: jest.fn((partial: Record<string, unknown>) => {
          Object.assign(tabsState, partial);
        }),
      } as unknown as DashboardScene;

      const executor = new DashboardMutationClient(tabsScene);
      const result = await executor.execute({
        type: 'REMOVE_TAB',
        payload: { path: '/tabs/0', moveContentTo: '/tabs/1' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty RowsLayout');
    });
  });

  describe('permission denied', () => {
    it('rejects layout commands when dashboard is not editable', async () => {
      const scene = buildRowsScene(['A']);
      (scene.canEditDashboard as jest.Mock).mockReturnValue(false);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'ADD_ROW',
        payload: {
          row: { kind: 'RowsLayoutRow', spec: { title: 'New' } },
          parentPath: '/',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('insufficient permissions');
    });
  });

  describe('repeat support', () => {
    it('ADD_ROW passes repeat to RowItem', async () => {
      const scene = buildRowsScene(['Existing']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'ADD_ROW',
        payload: {
          row: { kind: 'RowsLayoutRow', spec: { title: 'Repeated', repeat: { mode: 'variable', value: 'region' } } },
          parentPath: '/',
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as RowsLayoutManager;
      expect(body.state.rows[1].state.repeatByVariable).toBe('region');
    });

    it('ADD_TAB passes repeat to TabItem', async () => {
      const scene = buildTabsScene(['Existing']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'ADD_TAB',
        payload: {
          tab: { kind: 'TabsLayoutTab', spec: { title: 'Repeated', repeat: { mode: 'variable', value: 'env' } } },
          parentPath: '/',
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as TabsLayoutManager;
      expect(body.state.tabs[1].state.repeatByVariable).toBe('env');
    });

    it('UPDATE_ROW sets repeat', async () => {
      const scene = buildRowsScene(['Row A']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_ROW',
        payload: {
          path: '/rows/0',
          spec: { repeat: { mode: 'variable', value: 'cluster' } },
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as RowsLayoutManager;
      expect(body.state.rows[0].state.repeatByVariable).toBe('cluster');
    });

    it('UPDATE_ROW clears repeat', async () => {
      const row = new RowItem({
        title: 'Repeated',
        layout: DefaultGridLayoutManager.fromVizPanels([]),
        repeatByVariable: 'cluster',
      });
      const body = new RowsLayoutManager({ rows: [row] });
      const scene = buildSceneWithLayoutParent(body);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_ROW',
        payload: {
          path: '/rows/0',
          spec: { repeat: { mode: 'variable', value: '' } },
        },
      });

      expect(result.success).toBe(true);
      expect(row.state.repeatByVariable).toBeUndefined();
    });

    it('UPDATE_TAB sets repeat', async () => {
      const scene = buildTabsScene(['Tab A']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_TAB',
        payload: {
          path: '/tabs/0',
          spec: { repeat: { mode: 'variable', value: 'env' } },
        },
      });

      expect(result.success).toBe(true);
      const body = scene.state.body as unknown as TabsLayoutManager;
      expect(body.state.tabs[0].state.repeatByVariable).toBe('env');
    });

    it('UPDATE_TAB clears repeat', async () => {
      const tab = new TabItem({
        title: 'Repeated',
        layout: DefaultGridLayoutManager.fromVizPanels([]),
        repeatByVariable: 'env',
      });
      const body = new TabsLayoutManager({ tabs: [tab] });
      const scene = buildSceneWithLayoutParent(body);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'UPDATE_TAB',
        payload: {
          path: '/tabs/0',
          spec: { repeat: { mode: 'variable', value: '' } },
        },
      });

      expect(result.success).toBe(true);
      expect(tab.state.repeatByVariable).toBeUndefined();
    });
  });

  describe('feature toggle gate', () => {
    it('rejects layout commands when dashboardNewLayouts is disabled', async () => {
      config.featureToggles.dashboardNewLayouts = false;
      const scene = buildRowsScene(['A']);
      const executor = new DashboardMutationClient(scene);

      const result = await executor.execute({
        type: 'ADD_ROW',
        payload: {
          row: { kind: 'RowsLayoutRow', spec: { title: 'New' } },
          parentPath: '/',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('dashboardNewLayouts');
    });
  });
});
