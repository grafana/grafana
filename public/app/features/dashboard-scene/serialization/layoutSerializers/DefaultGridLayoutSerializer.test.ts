import { SceneGridLayout, VizPanel } from '@grafana/scenes';
import {
  Spec as DashboardV2Spec,
  defaultPanelSpec,
  GridLayoutItemKind,
  PanelKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { LibraryPanelBehavior } from '../../scene/LibraryPanelBehavior';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';

import {
  deserializeDefaultGridLayout,
  deserializeGridItem,
  gridItemToGridLayoutItemKind,
  serializeDefaultGridLayout,
} from './DefaultGridLayoutSerializer';
import './test-matchers';

jest.mock('../../utils/dashboardSceneGraph', () => {
  const original = jest.requireActual('../../utils/dashboardSceneGraph');
  return {
    ...original,
    dashboardSceneGraph: {
      ...original.dashboardSceneGraph,
      getElementIdentifierForVizPanel: jest.fn().mockImplementation((panel: VizPanel) => {
        return panel?.state?.key || 'panel-1';
      }),
    },
  };
});

function buildPanelElement(overrides: Partial<PanelKind['spec']> = {}): PanelKind {
  return {
    kind: 'Panel',
    spec: {
      ...defaultPanelSpec(),
      id: 1,
      title: 'Test Panel',
      ...overrides,
    },
  };
}

function buildGridItem(overrides: Partial<DashboardGridItem['state']> = {}): DashboardGridItem {
  return new DashboardGridItem({
    key: 'grid-item-1',
    x: 0,
    y: 0,
    width: 12,
    height: 8,
    body: new VizPanel({ key: 'panel-1', title: 'Test Panel', pluginId: 'timeseries' }),
    ...overrides,
  });
}

function buildLayoutManager(children: DashboardGridItem[] = []): DefaultGridLayoutManager {
  return new DefaultGridLayoutManager({
    grid: new SceneGridLayout({ children }),
  });
}

describe('serializeDefaultGridLayout', () => {
  it('serializes an empty grid', () => {
    const manager = buildLayoutManager();

    const result = serializeDefaultGridLayout(manager);

    expect(result).toEqual({
      kind: 'GridLayout',
      spec: { items: [] },
    });
  });

  it('serializes a single panel', () => {
    const manager = buildLayoutManager([buildGridItem({ x: 1, y: 2, width: 10, height: 6 })]);

    const result = serializeDefaultGridLayout(manager);

    expect(result).toEqual({
      kind: 'GridLayout',
      spec: {
        items: [
          {
            kind: 'GridLayoutItem',
            spec: {
              x: 1,
              y: 2,
              width: 10,
              height: 6,
              element: { kind: 'ElementReference', name: 'panel-1' },
            },
          },
        ],
      },
    });
  });

  it('serializes multiple panels preserving order', () => {
    const manager = buildLayoutManager([
      buildGridItem({
        key: 'grid-item-1',
        x: 0,
        y: 0,
        width: 12,
        height: 8,
        body: new VizPanel({ key: 'panel-A', title: 'Panel A', pluginId: 'timeseries' }),
      }),
      buildGridItem({
        key: 'grid-item-2',
        x: 12,
        y: 0,
        width: 12,
        height: 8,
        body: new VizPanel({ key: 'panel-B', title: 'Panel B', pluginId: 'timeseries' }),
      }),
    ]);

    expect(serializeDefaultGridLayout(manager)).toBeGridLayoutWith(({ items }) => {
      expect(items).toHaveLength(2);
      expect(items[0].spec.element.name).toBe('panel-A');
      expect(items[1].spec.element.name).toBe('panel-B');
    });
  });
});

describe('gridItemToGridLayoutItemKind', () => {
  it('produces correct position and element reference', () => {
    const gridItem = buildGridItem({ x: 3, y: 5, width: 6, height: 4 });

    const result = gridItemToGridLayoutItemKind(gridItem);

    expect(result).toEqual({
      kind: 'GridLayoutItem',
      spec: {
        x: 3,
        y: 5,
        width: 6,
        height: 4,
        element: { kind: 'ElementReference', name: 'panel-1' },
      },
    });
  });

  it('uses yOverride instead of the item y', () => {
    const gridItem = buildGridItem({ y: 10 });

    const result = gridItemToGridLayoutItemKind(gridItem, 42);

    expect(result.spec.y).toBe(42);
  });

  it('includes repeat options when variableName is set', () => {
    const gridItem = buildGridItem({ variableName: 'server', itemHeight: 8 });

    const result = gridItemToGridLayoutItemKind(gridItem);

    expect(result.spec.repeat).toEqual({
      mode: 'variable',
      value: 'server',
    });
  });

  it('includes maxPerRow in repeat options', () => {
    const gridItem = buildGridItem({ variableName: 'server', maxPerRow: 3, itemHeight: 8 });

    const result = gridItemToGridLayoutItemKind(gridItem);

    expect(result.spec.repeat?.maxPerRow).toBe(3);
  });

  it('includes direction in repeat options', () => {
    const gridItem = buildGridItem({ variableName: 'server', repeatDirection: 'v', itemHeight: 8 });

    const result = gridItemToGridLayoutItemKind(gridItem);

    expect(result.spec.repeat?.direction).toBe('v');
  });

  it('throws when body is not a VizPanel', () => {
    // Cast needed: DashboardGridItemState requires VizPanel, but we need a non-VizPanel to test the guard
    const gridItem = new DashboardGridItem({
      key: 'grid-item-1',
      x: 0,
      y: 0,
      width: 12,
      height: 8,
      body: {} as VizPanel,
    });

    expect(() => gridItemToGridLayoutItemKind(gridItem)).toThrow('DashboardGridItem body expected to be VizPanel');
  });
});

describe('deserializeDefaultGridLayout', () => {
  it('throws for non-GridLayout kind', () => {
    const layout = {
      kind: 'RowsLayout',
      spec: { rows: [] },
    } as unknown as DashboardV2Spec['layout'];

    expect(() => deserializeDefaultGridLayout(layout, {}, false)).toThrow('Invalid layout kind');
  });

  it('deserializes empty items', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'GridLayout',
      spec: { items: [] },
    };

    const result = deserializeDefaultGridLayout(layout, {}, false);

    expect(result).toBeInstanceOf(DefaultGridLayoutManager);
    expect(result.state.grid.state.children).toHaveLength(0);
  });

  it('deserializes a single panel element', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'GridLayout',
      spec: {
        items: [
          {
            kind: 'GridLayoutItem',
            spec: {
              x: 2,
              y: 3,
              width: 10,
              height: 5,
              element: { kind: 'ElementReference', name: 'panel-1' },
            },
          },
        ],
      },
    };
    const elements: DashboardV2Spec['elements'] = {
      'panel-1': buildPanelElement({ id: 1, title: 'My Panel' }),
    };

    const result = deserializeDefaultGridLayout(layout, elements, false);

    expect(result.state.grid.state.children).toHaveLength(1);
    expect(result.state.grid.state.children[0]).toBeDashboardGridItemWith((child) => {
      expect(child.state.x).toBe(2);
      expect(child.state.y).toBe(3);
      expect(child.state.width).toBe(10);
      expect(child.state.height).toBe(5);
      expect(child.state.body).toBeInstanceOf(VizPanel);
    });
  });

  it('deserializes a panel with repeat options', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'GridLayout',
      spec: {
        items: [
          {
            kind: 'GridLayoutItem',
            spec: {
              x: 0,
              y: 0,
              width: 12,
              height: 8,
              element: { kind: 'ElementReference', name: 'panel-1' },
              repeat: { mode: 'variable', value: 'server', direction: 'v', maxPerRow: 2 },
            },
          },
        ],
      },
    };
    const elements: DashboardV2Spec['elements'] = {
      'panel-1': buildPanelElement(),
    };

    const result = deserializeDefaultGridLayout(layout, elements, false);

    expect(result.state.grid.state.children[0]).toBeDashboardGridItemWith((child) => {
      expect(child.state.variableName).toBe('server');
      expect(child.state.repeatDirection).toBe('v');
      expect(child.state.maxPerRow).toBe(2);
    });
  });

  it('forces width to 24 when repeat direction is horizontal', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'GridLayout',
      spec: {
        items: [
          {
            kind: 'GridLayoutItem',
            spec: {
              x: 0,
              y: 0,
              width: 6,
              height: 8,
              element: { kind: 'ElementReference', name: 'panel-1' },
              repeat: { mode: 'variable', value: 'env', direction: 'h' },
            },
          },
        ],
      },
    };
    const elements: DashboardV2Spec['elements'] = {
      'panel-1': buildPanelElement(),
    };

    const result = deserializeDefaultGridLayout(layout, elements, false);

    expect(result.state.grid.state.children[0]).toBeDashboardGridItemWith((child) => {
      expect(child.state.width).toBe(24);
    });
  });

  it('deserializes a library panel element', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'GridLayout',
      spec: {
        items: [
          {
            kind: 'GridLayoutItem',
            spec: {
              x: 0,
              y: 0,
              width: 12,
              height: 8,
              element: { kind: 'ElementReference', name: 'lib-panel-1' },
            },
          },
        ],
      },
    };
    const elements: DashboardV2Spec['elements'] = {
      'lib-panel-1': {
        kind: 'LibraryPanel',
        spec: { id: 10, title: 'Lib Panel', libraryPanel: { uid: 'lib-uid', name: 'lib-name' } },
      },
    };

    const result = deserializeDefaultGridLayout(layout, elements, false);

    expect(result.state.grid.state.children[0]).toBeDashboardGridItemWith((child) => {
      expect(child.state.body).toBeInstanceOf(VizPanel);
      const behaviors = child.state.body.state.$behaviors ?? [];
      const libBehavior = behaviors.find((b) => b instanceof LibraryPanelBehavior);
      expect(libBehavior).toBeDefined();
    });
  });

  it('preserves order when deserializing multiple items', () => {
    const items: GridLayoutItemKind[] = [
      {
        kind: 'GridLayoutItem',
        spec: { x: 0, y: 0, width: 12, height: 8, element: { kind: 'ElementReference', name: 'p1' } },
      },
      {
        kind: 'GridLayoutItem',
        spec: { x: 12, y: 0, width: 12, height: 8, element: { kind: 'ElementReference', name: 'p2' } },
      },
      {
        kind: 'GridLayoutItem',
        spec: { x: 0, y: 8, width: 24, height: 4, element: { kind: 'ElementReference', name: 'p3' } },
      },
    ];
    const layout: DashboardV2Spec['layout'] = { kind: 'GridLayout', spec: { items } };
    const elements: DashboardV2Spec['elements'] = {
      p1: buildPanelElement({ id: 1, title: 'P1' }),
      p2: buildPanelElement({ id: 2, title: 'P2' }),
      p3: buildPanelElement({ id: 3, title: 'P3' }),
    };

    const result = deserializeDefaultGridLayout(layout, elements, false);

    const children = result.state.grid.state.children;
    expect(children).toHaveLength(3);
    expect(children[0]).toBeDashboardGridItemWith((child) => expect(child.state.x).toBe(0));
    expect(children[1]).toBeDashboardGridItemWith((child) => expect(child.state.x).toBe(12));
    expect(children[2]).toBeDashboardGridItemWith((child) => expect(child.state.width).toBe(24));
  });

  it('uses custom panelIdGenerator for keys', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'GridLayout',
      spec: {
        items: [
          {
            kind: 'GridLayoutItem',
            spec: { x: 0, y: 0, width: 12, height: 8, element: { kind: 'ElementReference', name: 'p1' } },
          },
        ],
      },
    };
    const elements: DashboardV2Spec['elements'] = {
      p1: buildPanelElement({ id: 1 }),
    };
    let counter = 100;
    const panelIdGenerator = () => counter++;

    const result = deserializeDefaultGridLayout(layout, elements, false, panelIdGenerator);

    expect(result.state.grid.state.children[0]).toBeDashboardGridItemWith((child) => {
      expect(child.state.key).toBe('grid-item-100');
    });
  });
});

describe('deserializeGridItem', () => {
  it('throws when the element reference is not found', () => {
    const item: GridLayoutItemKind = {
      kind: 'GridLayoutItem',
      spec: { x: 0, y: 0, width: 12, height: 8, element: { kind: 'ElementReference', name: 'missing' } },
    };
    const elements: DashboardV2Spec['elements'] = {};

    expect(() => deserializeGridItem(item, elements)).toThrow(
      'Panel with uid missing not found in the dashboard elements'
    );
  });
});

describe('repeaterToLayoutItems (via serializeDefaultGridLayout)', () => {
  it('serializes a repeater as a single item when not a snapshot', () => {
    const manager = buildLayoutManager([buildGridItem({ variableName: 'host', itemHeight: 8 })]);

    expect(serializeDefaultGridLayout(manager, false)).toBeGridLayoutWith(({ items }) => {
      expect(items).toHaveLength(1);
      expect(items[0].spec.repeat).toEqual({
        mode: 'variable',
        value: 'host',
      });
    });
  });

  it('serializes expanded horizontal clones in snapshot mode', () => {
    const sourcePanel = new VizPanel({ key: 'panel-1', title: 'Source', pluginId: 'timeseries' });
    const clone1 = new VizPanel({
      key: 'clone-1',
      title: 'Clone 1',
      pluginId: 'timeseries',
      repeatSourceKey: 'panel-1',
    });
    const clone2 = new VizPanel({
      key: 'clone-2',
      title: 'Clone 2',
      pluginId: 'timeseries',
      repeatSourceKey: 'panel-1',
    });

    const gridItem = new DashboardGridItem({
      key: 'grid-item-1',
      x: 0,
      y: 0,
      width: 24,
      height: 8,
      itemHeight: 8,
      body: sourcePanel,
      variableName: 'host',
      repeatDirection: 'h',
      maxPerRow: 2,
      repeatedPanels: [clone1, clone2],
    });

    const manager = buildLayoutManager([gridItem]);

    expect(serializeDefaultGridLayout(manager, true)).toBeGridLayoutWith(({ items }) => {
      expect(items).toHaveLength(3);
      expect(items[0].spec.element.name).toBe('panel-1');
      expect(items[1].spec.element.name).toBe('clone-1');
      expect(items[2].spec.element.name).toBe('clone-2');
    });
  });

  it('serializes expanded vertical clones in snapshot mode', () => {
    const sourcePanel = new VizPanel({ key: 'panel-1', title: 'Source', pluginId: 'timeseries' });
    const clone1 = new VizPanel({
      key: 'clone-1',
      title: 'Clone 1',
      pluginId: 'timeseries',
      repeatSourceKey: 'panel-1',
    });

    const gridItem = new DashboardGridItem({
      key: 'grid-item-1',
      x: 5,
      y: 10,
      width: 12,
      height: 16,
      itemHeight: 8,
      body: sourcePanel,
      variableName: 'host',
      repeatDirection: 'v',
      repeatedPanels: [clone1],
    });

    const manager = buildLayoutManager([gridItem]);

    expect(serializeDefaultGridLayout(manager, true)).toBeGridLayoutWith(({ items }) => {
      expect(items).toHaveLength(2);
      expect(items[0].spec.x).toBe(5);
      expect(items[0].spec.y).toBe(10);
      expect(items[1].spec.x).toBe(5);
      expect(items[1].spec.y).toBe(18);
    });
  });

  it('returns empty array for snapshot of a library panel repeater', () => {
    const libPanel = new VizPanel({
      key: 'panel-1',
      title: 'Lib',
      pluginId: 'timeseries',
      $behaviors: [new LibraryPanelBehavior({ uid: 'lib-uid', name: 'lib-name' })],
    });

    const gridItem = new DashboardGridItem({
      key: 'grid-item-1',
      x: 0,
      y: 0,
      width: 24,
      height: 8,
      itemHeight: 8,
      body: libPanel,
      variableName: 'host',
      repeatedPanels: [
        new VizPanel({ key: 'clone-1', title: 'Clone', pluginId: 'timeseries', repeatSourceKey: 'panel-1' }),
      ],
    });

    const manager = buildLayoutManager([gridItem]);

    expect(serializeDefaultGridLayout(manager, true)).toBeGridLayoutWith(({ items }) => {
      expect(items).toEqual([]);
    });
  });

  it('falls back to single item when snapshot repeater has not expanded yet', () => {
    const gridItem = buildGridItem({ variableName: 'host', itemHeight: 8 });

    const manager = buildLayoutManager([gridItem]);

    expect(serializeDefaultGridLayout(manager, true)).toBeGridLayoutWith(({ items }) => {
      expect(items).toHaveLength(1);
      expect(items[0].spec.repeat).toEqual({
        mode: 'variable',
        value: 'host',
      });
    });
  });
});
