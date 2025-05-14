import { SceneCSSGridLayout, SceneGridLayout } from '@grafana/scenes';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';

import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { ResponsiveGridLayoutManager } from '../../scene/layout-responsive-grid/ResponsiveGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowItemRepeaterBehavior } from '../../scene/layout-rows/RowItemRepeaterBehavior';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';

import { RowsLayoutSerializer } from './RowsLayoutSerializer';

describe('deserialization', () => {
  it('should deserialize rows layout with default grid child', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row 1',
              collapsed: false,
              layout: { kind: 'GridLayout', spec: { items: [] } },
            },
          },
        ],
      },
    };
    const serializer = new RowsLayoutSerializer();
    const deserialized = serializer.deserialize(layout, {}, false);
    expect(deserialized).toBeInstanceOf(RowsLayoutManager);
    expect(deserialized.state.rows[0].state.layout).toBeInstanceOf(DefaultGridLayoutManager);
  });

  it('should deserialize rows layout with responsive grid child', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row 1',
              collapsed: false,
              layout: {
                kind: 'ResponsiveGridLayout',
                spec: {
                  row: 'minmax(min-content, max-content)',
                  col: 'repeat(auto-fit, minmax(400px, 1fr))',
                  items: [],
                },
              },
            },
          },
        ],
      },
    };
    const serializer = new RowsLayoutSerializer();
    const deserialized = serializer.deserialize(layout, {}, false);
    expect(deserialized).toBeInstanceOf(RowsLayoutManager);
    expect(deserialized.state.rows[0].state.layout).toBeInstanceOf(ResponsiveGridLayoutManager);
  });

  it('should handle multiple rows with different layouts', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row 1',
              collapsed: false,
              layout: {
                kind: 'ResponsiveGridLayout',
                spec: {
                  row: 'minmax(min-content, max-content)',
                  col: 'repeat(auto-fit, minmax(400px, 1fr))',
                  items: [],
                },
              },
            },
          },
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row 2',
              collapsed: true,
              layout: { kind: 'GridLayout', spec: { items: [] } },
            },
          },
        ],
      },
    };
    const serializer = new RowsLayoutSerializer();
    const deserialized = serializer.deserialize(layout, {}, false);
    expect(deserialized).toBeInstanceOf(RowsLayoutManager);
    expect(deserialized.state.rows).toHaveLength(2);
    expect(deserialized.state.rows[0].state.layout).toBeInstanceOf(ResponsiveGridLayoutManager);
    expect(deserialized.state.rows[1].state.layout).toBeInstanceOf(DefaultGridLayoutManager);
    expect(deserialized.state.rows[0].state.isCollapsed).toBe(false);
    expect(deserialized.state.rows[1].state.isCollapsed).toBe(true);
  });

  it('should handle 0 rows', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'RowsLayout',
      spec: {
        rows: [],
      },
    };
    const serializer = new RowsLayoutSerializer();
    const deserialized = serializer.deserialize(layout, {}, false);
    expect(deserialized).toBeInstanceOf(RowsLayoutManager);
    expect(deserialized.state.rows).toHaveLength(0);
  });

  it('should deserialize row with repeat behavior', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Repeated Row',
              collapsed: false,
              layout: { kind: 'GridLayout', spec: { items: [] } },
              repeat: { value: 'foo', mode: 'variable' },
            },
          },
        ],
      },
    };
    const serializer = new RowsLayoutSerializer();
    const deserialized = serializer.deserialize(layout, {}, false);

    expect(deserialized).toBeInstanceOf(RowsLayoutManager);
    expect(deserialized.state.rows).toHaveLength(1);

    const row = deserialized.state.rows[0];
    expect(row.state.$behaviors).toBeDefined();
    const behaviors = row.state.$behaviors ?? [];
    expect(behaviors).toHaveLength(1);
    const repeaterBehavior = behaviors[0] as RowItemRepeaterBehavior;
    expect(repeaterBehavior).toBeInstanceOf(RowItemRepeaterBehavior);
    expect(repeaterBehavior.state.variableName).toBe('foo');
  });
});

describe('serialization', () => {
  it('should serialize basic row layout', () => {
    const rowsLayout = new RowsLayoutManager({
      rows: [
        new RowItem({
          title: 'Row 1',
          isCollapsed: false,
          layout: new DefaultGridLayoutManager({
            grid: new SceneGridLayout({
              children: [],
              isDraggable: true,
              isResizable: true,
            }),
          }),
        }),
      ],
    });

    const serializer = new RowsLayoutSerializer();
    const serialized = serializer.serialize(rowsLayout);

    expect(serialized).toEqual({
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row 1',
              collapsed: false,
              layout: { kind: 'GridLayout', spec: { items: [] } },
            },
          },
        ],
      },
    });
  });

  it('should serialize row with repeat behavior', () => {
    const rowsLayout = new RowsLayoutManager({
      rows: [
        new RowItem({
          title: 'Repeated Row',
          isCollapsed: false,
          layout: new DefaultGridLayoutManager({
            grid: new SceneGridLayout({
              children: [],
              isDraggable: true,
              isResizable: true,
            }),
          }),
          $behaviors: [new RowItemRepeaterBehavior({ variableName: 'foo' })],
        }),
      ],
    });

    const serializer = new RowsLayoutSerializer();
    const serialized = serializer.serialize(rowsLayout);

    expect(serialized).toEqual({
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Repeated Row',
              collapsed: false,
              layout: { kind: 'GridLayout', spec: { items: [] } },
              repeat: { value: 'foo', mode: 'variable' },
            },
          },
        ],
      },
    });
  });

  it('should serialize multiple rows with different layouts', () => {
    const rowsLayout = new RowsLayoutManager({
      rows: [
        new RowItem({
          title: 'Row 1',
          isCollapsed: false,
          layout: new ResponsiveGridLayoutManager({
            layout: new SceneCSSGridLayout({
              children: [],
              templateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
              autoRows: 'minmax(min-content, max-content)',
            }),
          }),
        }),
        new RowItem({
          title: 'Row 2',
          isCollapsed: true,
          layout: new DefaultGridLayoutManager({
            grid: new SceneGridLayout({
              children: [],
              isDraggable: true,
              isResizable: true,
            }),
          }),
        }),
      ],
    });

    const serializer = new RowsLayoutSerializer();
    const serialized = serializer.serialize(rowsLayout);

    expect(serialized).toEqual({
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row 1',
              collapsed: false,
              layout: {
                kind: 'ResponsiveGridLayout',
                spec: {
                  row: 'minmax(min-content, max-content)',
                  col: 'repeat(auto-fit, minmax(400px, 1fr))',
                  items: [],
                },
              },
            },
          },
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row 2',
              collapsed: true,
              layout: { kind: 'GridLayout', spec: { items: [] } },
            },
          },
        ],
      },
    });
  });
});
