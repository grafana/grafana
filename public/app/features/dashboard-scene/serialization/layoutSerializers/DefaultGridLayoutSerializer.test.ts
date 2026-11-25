import { SceneGridLayout, SceneGridRow, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowRepeaterBehavior } from '../../scene/layout-default/RowRepeaterBehavior';

import { serializeDefaultGridLayout } from './DefaultGridLayoutSerializer';

function gridItem(id: number, pos: { x: number; y: number; width: number; height: number }) {
  return new DashboardGridItem({
    key: `grid-item-${id}`,
    ...pos,
    body: new VizPanel({ key: `panel-${id}`, title: `Panel ${id}`, pluginId: 'text' }),
  });
}

function gridLayoutItem(id: number, pos: { x: number; y: number; width: number; height: number }) {
  return {
    kind: 'GridLayoutItem',
    spec: { ...pos, element: { kind: 'ElementReference', name: `panel-${id}` } },
  };
}

// Serializing items resolves element ids through the scene, so the manager must be attached to a DashboardScene.
function attach(children: SceneGridLayout['state']['children']) {
  const manager = new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children }) });
  new DashboardScene({ body: manager });
  return manager;
}

describe('serializeDefaultGridLayout', () => {
  it('serializes a grid without rows as a GridLayout', () => {
    const manager = attach([
      gridItem(1, { x: 0, y: 0, width: 12, height: 8 }),
      gridItem(2, { x: 12, y: 0, width: 12, height: 8 }),
    ]);

    expect(serializeDefaultGridLayout(manager)).toEqual({
      kind: 'GridLayout',
      spec: {
        items: [
          gridLayoutItem(1, { x: 0, y: 0, width: 12, height: 8 }),
          gridLayoutItem(2, { x: 12, y: 0, width: 12, height: 8 }),
        ],
      },
    });
  });

  it('keeps the panels of v1 rows by serializing the grid as a RowsLayout', () => {
    const expandedRow = new SceneGridRow({
      key: 'row-expanded',
      title: 'DORA Metrics',
      y: 3,
      children: [gridItem(2, { x: 0, y: 4, width: 12, height: 6 }), gridItem(3, { x: 12, y: 4, width: 12, height: 6 })],
    });
    // A collapsed row keeps the absolute y its panels had when it was last expanded.
    const collapsedRow = new SceneGridRow({
      key: 'row-collapsed',
      title: 'Deployment History',
      y: 11,
      isCollapsed: true,
      children: [
        gridItem(4, { x: 0, y: 30, width: 24, height: 8 }),
        gridItem(5, { x: 0, y: 38, width: 24, height: 8 }),
      ],
    });
    const children = [gridItem(1, { x: 0, y: 0, width: 24, height: 3 }), expandedRow, collapsedRow];
    const manager = attach(children);

    expect(serializeDefaultGridLayout(manager)).toEqual({
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: '',
              collapse: false,
              hideHeader: true,
              layout: {
                kind: 'GridLayout',
                spec: { items: [gridLayoutItem(1, { x: 0, y: 0, width: 24, height: 3 })] },
              },
            },
          },
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'DORA Metrics',
              collapse: false,
              layout: {
                kind: 'GridLayout',
                spec: {
                  items: [
                    gridLayoutItem(2, { x: 0, y: 0, width: 12, height: 6 }),
                    gridLayoutItem(3, { x: 12, y: 0, width: 12, height: 6 }),
                  ],
                },
              },
            },
          },
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Deployment History',
              collapse: true,
              layout: {
                kind: 'GridLayout',
                spec: {
                  items: [
                    gridLayoutItem(4, { x: 0, y: 0, width: 24, height: 8 }),
                    gridLayoutItem(5, { x: 0, y: 8, width: 24, height: 8 }),
                  ],
                },
              },
            },
          },
        ],
      },
    });

    // Serialization must not reparent the live scene's grid items.
    expect(manager.state.grid.state.children).toEqual(children);
    expect(expandedRow.parent).toBe(manager.state.grid);
    expect(expandedRow.state.children.map((child) => child.parent)).toEqual([expandedRow, expandedRow]);
    expect(collapsedRow.state.children.map((child) => child.parent)).toEqual([collapsedRow, collapsedRow]);
  });

  it('serializes a repeated v1 row once, with its repeat, and skips its clones', () => {
    const manager = attach([
      new SceneGridRow({
        key: 'row-server',
        title: 'Server $server',
        y: 0,
        $behaviors: [new RowRepeaterBehavior({ variableName: 'server' })],
        children: [gridItem(1, { x: 0, y: 1, width: 24, height: 8 })],
      }),
      new SceneGridRow({
        key: 'row-server-clone-1',
        repeatSourceKey: 'row-server',
        title: 'Server $server',
        y: 9,
        children: [gridItem(2, { x: 0, y: 10, width: 24, height: 8 })],
      }),
    ]);

    expect(serializeDefaultGridLayout(manager)).toEqual({
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Server $server',
              collapse: false,
              repeat: { mode: 'variable', value: 'server' },
              layout: {
                kind: 'GridLayout',
                spec: { items: [gridLayoutItem(1, { x: 0, y: 0, width: 24, height: 8 })] },
              },
            },
          },
        ],
      },
    });
  });
});
