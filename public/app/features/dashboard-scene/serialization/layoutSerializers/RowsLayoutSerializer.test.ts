import { SceneGridLayout } from '@grafana/scenes';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';

import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { AutoGridLayout } from '../../scene/layout-responsive-grid/ResponsiveGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-responsive-grid/ResponsiveGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowItemRepeaterBehavior } from '../../scene/layout-rows/RowItemRepeaterBehavior';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';

import { deserializeRowsLayout, serializeRowsLayout } from './RowsLayoutSerializer';

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
              collapse: false,
              layout: { kind: 'GridLayout', spec: { items: [] } },
            },
          },
        ],
      },
    };
    const deserialized = deserializeRowsLayout(layout, {}, false);
    expect(deserialized).toBeInstanceOf(RowsLayoutManager);
    expect(deserialized.state.rows[0].state.layout).toBeInstanceOf(DefaultGridLayoutManager);
  });

  it('should deserialize rows layout with collapse and hideHeader properly set', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row 1',
              collapse: true,
              hideHeader: true,
              fillScreen: true,
              layout: { kind: 'GridLayout', spec: { items: [] } },
            },
          },
        ],
      },
    };
    const deserialized = deserializeRowsLayout(layout, {}, false);
    expect(deserialized).toBeInstanceOf(RowsLayoutManager);
    expect(deserialized.state.rows[0].state.layout).toBeInstanceOf(DefaultGridLayoutManager);
    expect(deserialized.state.rows[0].state.collapse).toBe(true);
    expect(deserialized.state.rows[0].state.hideHeader).toBe(true);
    expect(deserialized.state.rows[0].state.fillScreen).toBe(true);
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
              collapse: false,
              layout: {
                kind: 'AutoGridLayout',
                spec: {
                  columnWidthMode: 'standard',
                  rowHeightMode: 'standard',
                  maxColumnCount: 4,
                  items: [],
                },
              },
            },
          },
        ],
      },
    };
    const deserialized = deserializeRowsLayout(layout, {}, false);
    expect(deserialized).toBeInstanceOf(RowsLayoutManager);
    expect(deserialized.state.rows[0].state.layout).toBeInstanceOf(AutoGridLayoutManager);
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
              collapse: false,
              hideHeader: undefined,
              fillScreen: undefined,
              layout: {
                kind: 'AutoGridLayout',
                spec: {
                  columnWidthMode: 'standard',
                  rowHeightMode: 'standard',
                  maxColumnCount: 4,
                  items: [],
                },
              },
            },
          },
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row 2',
              collapse: true,
              hideHeader: undefined,
              fillScreen: undefined,
              layout: { kind: 'GridLayout', spec: { items: [] } },
            },
          },
        ],
      },
    };
    const deserialized = deserializeRowsLayout(layout, {}, false);
    expect(deserialized).toBeInstanceOf(RowsLayoutManager);
    expect(deserialized.state.rows).toHaveLength(2);
    expect(deserialized.state.rows[0].state.layout).toBeInstanceOf(AutoGridLayoutManager);
    expect(deserialized.state.rows[1].state.layout).toBeInstanceOf(DefaultGridLayoutManager);
    expect(deserialized.state.rows[0].state.collapse).toBe(false);
    expect(deserialized.state.rows[1].state.collapse).toBe(true);
  });

  it('should handle 0 rows', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'RowsLayout',
      spec: {
        rows: [],
      },
    };
    const deserialized = deserializeRowsLayout(layout, {}, false);
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
              collapse: false,
              hideHeader: undefined,
              fillScreen: undefined,
              layout: { kind: 'GridLayout', spec: { items: [] } },
              repeat: { value: 'foo', mode: 'variable' },
            },
          },
        ],
      },
    };
    const deserialized = deserializeRowsLayout(layout, {}, false);

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
          collapse: false,
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

    const serialized = serializeRowsLayout(rowsLayout);

    expect(serialized).toEqual({
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row 1',
              collapse: false,
              hideHeader: undefined,
              fillScreen: undefined,
              layout: { kind: 'GridLayout', spec: { items: [] } },
            },
          },
        ],
      },
    });
  });

  it('should serialize basic row layout with collapse and hideHeader', () => {
    const rowsLayout = new RowsLayoutManager({
      rows: [
        new RowItem({
          title: 'Row 1',
          collapse: true,
          hideHeader: true,
          fillScreen: true,
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

    const serialized = serializeRowsLayout(rowsLayout);

    expect(serialized).toEqual({
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row 1',
              collapse: true,
              hideHeader: true,
              fillScreen: true,
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
          collapse: false,
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

    const serialized = serializeRowsLayout(rowsLayout);

    expect(serialized).toEqual({
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Repeated Row',
              collapse: false,
              hideHeader: undefined,
              fillScreen: undefined,
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
          collapse: false,
          hideHeader: undefined,
          fillScreen: undefined,
          layout: new AutoGridLayoutManager({
            columnWidth: 'standard',
            rowHeight: 'standard',
            maxColumnCount: 4,
            layout: new AutoGridLayout({}),
          }),
        }),
        new RowItem({
          title: 'Row 2',
          collapse: true,
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

    const serialized = serializeRowsLayout(rowsLayout);

    expect(serialized).toEqual({
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row 1',
              collapse: false,
              hideHeader: undefined,
              fillScreen: undefined,
              layout: {
                kind: 'AutoGridLayout',
                spec: {
                  columnWidth: undefined,
                  rowHeight: undefined,
                  fillScreen: undefined,
                  rowHeightMode: 'standard',
                  columnWidthMode: 'standard',
                  maxColumnCount: 4,
                  items: [],
                },
              },
            },
          },
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row 2',
              collapse: true,
              hideHeader: undefined,
              fillScreen: undefined,
              layout: { kind: 'GridLayout', spec: { items: [] } },
            },
          },
        ],
      },
    });
  });
});
