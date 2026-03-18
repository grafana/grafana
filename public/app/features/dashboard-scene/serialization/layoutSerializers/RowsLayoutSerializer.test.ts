import { SceneGridLayout, VizPanel } from '@grafana/scenes';
import { Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { ConditionalRenderingVariable } from '../../conditional-rendering/conditions/ConditionalRenderingVariable';
import { ConditionalRenderingGroup } from '../../conditional-rendering/group/ConditionalRenderingGroup';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';

import { deserializeRowsLayout, serializeRow, serializeRowsLayout } from './RowsLayoutSerializer';

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

function buildRowItem(overrides: Partial<RowItem['state']> = {}): RowItem {
  return new RowItem({
    title: 'Row 1',
    collapse: false,
    layout: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({ children: [] }),
    }),
    ...overrides,
  });
}

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
    expect(row.state.repeatByVariable).toBe('foo');
  });

  it('throws for non-RowsLayout kind', () => {
    const layout = {
      kind: 'TabsLayout',
      spec: { tabs: [] },
    } as unknown as DashboardV2Spec['layout'];

    expect(() => deserializeRowsLayout(layout, {}, false)).toThrow('Invalid layout kind');
  });

  it('should deserialize row with conditional rendering', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Conditional',
              collapse: false,
              layout: { kind: 'GridLayout', spec: { items: [] } },
              conditionalRendering: {
                kind: 'ConditionalRenderingGroup',
                spec: {
                  visibility: 'show',
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
          },
        ],
      },
    };

    const deserialized = deserializeRowsLayout(layout, {}, false);

    const condRendering = deserialized.state.rows[0].state.conditionalRendering;
    expect(condRendering).toBeInstanceOf(ConditionalRenderingGroup);
    expect(condRendering?.state.conditions).toHaveLength(1);
  });
});

describe('serializeRowsLayout', () => {
  it('filters out rows with repeatSourceKey', () => {
    const source = buildRowItem({ title: 'Source' });
    const clone = buildRowItem({ title: 'Clone', repeatSourceKey: 'source-key' });
    const manager = new RowsLayoutManager({ rows: [source, clone] });

    const serialized = serializeRowsLayout(manager);

    expect(serialized.kind).toBe('RowsLayout');
    if (serialized.kind !== 'RowsLayout') {
      throw new Error('unexpected');
    }
    expect(serialized.spec.rows).toHaveLength(1);
    expect(serialized.spec.rows[0].spec.title).toBe('Source');
  });
});

describe('serializeRow', () => {
  it('normalizes Y coordinates to be relative within the row', () => {
    const row = buildRowItem({
      layout: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [
            new DashboardGridItem({
              key: 'grid-item-1',
              x: 0,
              y: 10,
              width: 12,
              height: 8,
              body: new VizPanel({ key: 'panel-A', title: 'A', pluginId: 'timeseries' }),
            }),
            new DashboardGridItem({
              key: 'grid-item-2',
              x: 12,
              y: 14,
              width: 12,
              height: 4,
              body: new VizPanel({ key: 'panel-B', title: 'B', pluginId: 'timeseries' }),
            }),
          ],
        }),
      }),
    });

    const result = serializeRow(row);

    expect(result.spec.layout.kind).toBe('GridLayout');
    if (result.spec.layout.kind !== 'GridLayout') {
      throw new Error('unexpected');
    }
    const items = result.spec.layout.spec.items;
    expect(items[0].spec.y).toBe(0);
    expect(items[1].spec.y).toBe(4);
  });

  it('includes conditional rendering when it has items', () => {
    const condRendering = new ConditionalRenderingGroup({
      condition: 'and',
      visibility: 'show',
      renderHidden: false,
      conditions: [ConditionalRenderingVariable.createEmpty('myVar')],
      result: true,
    });
    const row = buildRowItem({ conditionalRendering: condRendering });

    const result = serializeRow(row);

    expect(result.spec.conditionalRendering).toBeDefined();
    expect(result.spec.conditionalRendering?.spec.items).toHaveLength(1);
  });

  it('omits conditional rendering when it has no items', () => {
    const row = buildRowItem();

    const result = serializeRow(row);

    expect(result.spec.conditionalRendering).toBeUndefined();
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
          repeatByVariable: 'foo',
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
