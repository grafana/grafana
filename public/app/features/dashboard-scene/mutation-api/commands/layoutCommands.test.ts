import { config } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { MutationExecutor } from '../MutationExecutor';
import type { MutableDashboardScene, MutationResult } from '../types';

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

function buildRowsScene(rowTitles: string[] = ['Row A', 'Row B']): MutableDashboardScene {
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
  return scene as unknown as MutableDashboardScene;
}

function buildTabsScene(tabTitles: string[] = ['Tab A', 'Tab B']): MutableDashboardScene {
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
  return scene as unknown as MutableDashboardScene;
}

function buildRowsSceneWithPanels(): MutableDashboardScene {
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
  return scene as unknown as MutableDashboardScene;
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
      const executor = new MutationExecutor(scene);

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
      const executor = new MutationExecutor(scene);

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
      const executor = new MutationExecutor(scene);

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
      const executor = new MutationExecutor(scene);

      const result = await executor.execute({
        type: 'REMOVE_ROW',
        payload: { path: '/rows/5' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('out of bounds');
    });
  });

  describe('UPDATE_ROW', () => {
    it('updates row title', async () => {
      const scene = buildRowsScene(['Old Title']);
      const executor = new MutationExecutor(scene);

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
      const executor = new MutationExecutor(scene);

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
      const executor = new MutationExecutor(scene);

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
      const executor = new MutationExecutor(scene);

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
      const executor = new MutationExecutor(scene);

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
      const executor = new MutationExecutor(scene);

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
      const executor = new MutationExecutor(scene);

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
      const executor = new MutationExecutor(scene);

      const result = await executor.execute({
        type: 'REMOVE_TAB',
        payload: { path: '/tabs/5' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('out of bounds');
    });
  });

  describe('UPDATE_TAB', () => {
    it('updates tab title', async () => {
      const scene = buildTabsScene(['Old Title']);
      const executor = new MutationExecutor(scene);

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
      const executor = new MutationExecutor(scene);

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
      const executor = new MutationExecutor(scene);

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
      const executor = new MutationExecutor(scene);

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
      const executor = new MutationExecutor(scene);

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
      const executor = new MutationExecutor(scene);

      const result = await executor.execute({ type: 'GET_LAYOUT', payload: {} });

      expect(result.success).toBe(true);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      const data = result.data as { layout: any; elements: Record<string, unknown> };
      expect(data.elements).toEqual({});
    });

    it('is rejected when feature toggle is disabled', async () => {
      config.featureToggles.dashboardNewLayouts = false;
      const scene = buildRowsScene(['Row']);
      const executor = new MutationExecutor(scene);

      const result = await executor.execute({ type: 'GET_LAYOUT', payload: {} });

      expect(result.success).toBe(false);
      expect(result.error).toContain('dashboardNewLayouts');
    });
  });

  describe('MOVE_PANEL', () => {
    it('moves a panel from one row to another', async () => {
      const scene = buildRowsSceneWithPanels();
      const executor = new MutationExecutor(scene);
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
      const executor = new MutationExecutor(scene);

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
      const executor = new MutationExecutor(scene);

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

    it('fails when element is not found', async () => {
      const scene = buildRowsSceneWithPanels();
      const executor = new MutationExecutor(scene);

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
      const executor = new MutationExecutor(scene);

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
      } as unknown as MutableDashboardScene;

      const executor = new MutationExecutor(scene);
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
      } as unknown as MutableDashboardScene;

      const executor = new MutationExecutor(scene);
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
      } as unknown as MutableDashboardScene;

      const executor = new MutationExecutor(scene);
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
      } as unknown as MutableDashboardScene;

      const executor = new MutationExecutor(scene);
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

  describe('movePanelsTo on remove', () => {
    it('moves panels when removing a row with movePanelsTo', async () => {
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
      } as unknown as MutableDashboardScene;

      const executor = new MutationExecutor(scene);
      const result = await executor.execute({
        type: 'REMOVE_ROW',
        payload: {
          path: '/rows/0',
          movePanelsTo: '/rows/1',
        },
      });

      expect(result.success).toBe(true);
      // Row 1 removed, panels should be moved to what was Row 2 (now Row 0 after removal)
      expect(body.state.rows).toHaveLength(1);
      expect(body.state.rows[0].state.title).toBe('Row 2');
      expect(body.state.rows[0].state.layout.getVizPanels()).toHaveLength(1);
    });

    it('preserves panel titles when moving via movePanelsTo', async () => {
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
      } as unknown as MutableDashboardScene;

      const executor = new MutationExecutor(scene);
      const result = await executor.execute({
        type: 'REMOVE_ROW',
        payload: { path: '/rows/0', movePanelsTo: '/rows/1' },
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
      } as unknown as MutableDashboardScene;

      const executor = new MutationExecutor(scene);
      const result = await executor.execute({
        type: 'REMOVE_TAB',
        payload: { path: '/tabs/0', movePanelsTo: '/tabs/1' },
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
      } as unknown as MutableDashboardScene;

      const executor = new MutationExecutor(scene);
      const result = await executor.execute({
        type: 'REMOVE_TAB',
        payload: { path: '/tabs/0', movePanelsTo: '/tabs/1' },
      });

      expect(result.success).toBe(true);
      const targetRows = (body.state.tabs[0].state.layout as RowsLayoutManager).state.rows;
      expect(targetRows[0].state.layout.getVizPanels()).toHaveLength(1);
      expect(targetRows[0].state.layout.getVizPanels()[0].state.title).toBe('Panel A');
    });

    it('fails when movePanelsTo targets an empty RowsLayout', async () => {
      const panelA = new VizPanel({ key: 'panel-1', title: 'Panel A', pluginId: 'timeseries' });

      // movePanelsTo targets "/" which is the RowsLayoutManager itself.
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
      } as unknown as MutableDashboardScene;

      const executor = new MutationExecutor(tabsScene);
      const result = await executor.execute({
        type: 'REMOVE_TAB',
        payload: { path: '/tabs/0', movePanelsTo: '/tabs/1' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty RowsLayout');
    });
  });

  describe('permission denied', () => {
    it('rejects layout commands when dashboard is not editable', async () => {
      const scene = buildRowsScene(['A']);
      (scene.canEditDashboard as jest.Mock).mockReturnValue(false);
      const executor = new MutationExecutor(scene);

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

  describe('feature toggle gate', () => {
    it('rejects layout commands when dashboardNewLayouts is disabled', async () => {
      config.featureToggles.dashboardNewLayouts = false;
      const scene = buildRowsScene(['A']);
      const executor = new MutationExecutor(scene);

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
