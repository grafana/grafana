import { CustomVariable, SceneGridLayout, SceneVariableSet } from '@grafana/scenes';
import { type Spec as DashboardV2Spec, type RowsLayoutSpec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
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
    expect(row.state.repeatByVariable).toBe('foo');
  });

  it('should deserialize row with section variables', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row with vars',
              collapse: false,
              layout: { kind: 'GridLayout', spec: { items: [] } },
              variables: [
                {
                  kind: 'CustomVariable',
                  spec: {
                    name: 'env',
                    label: 'Environment',
                    query: 'dev,staging,prod',
                    current: { text: 'dev', value: 'dev' },
                    options: [],
                    multi: false,
                    includeAll: false,
                    hide: 'dontHide',
                    skipUrlSync: false,
                    allowCustomValue: true,
                  },
                },
              ],
            },
          },
        ],
      },
    };
    const deserialized = deserializeRowsLayout(layout, {}, false);

    const row = deserialized.state.rows[0];
    expect(row.state.$variables).toBeInstanceOf(SceneVariableSet);
    expect(row.state.$variables!.state.variables).toHaveLength(1);
    expect(row.state.$variables!.state.variables[0].state.name).toBe('env');
  });

  it('should deserialize row without section variables as undefined $variables', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row without vars',
              collapse: false,
              layout: { kind: 'GridLayout', spec: { items: [] } },
            },
          },
        ],
      },
    };
    const deserialized = deserializeRowsLayout(layout, {}, false);

    const row = deserialized.state.rows[0];
    expect(row.state.$variables).toBeUndefined();
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

  it('should serialize row with section variables', () => {
    const rowsLayout = new RowsLayoutManager({
      rows: [
        new RowItem({
          title: 'Row with vars',
          collapse: false,
          layout: new DefaultGridLayoutManager({
            grid: new SceneGridLayout({
              children: [],
              isDraggable: true,
              isResizable: true,
            }),
          }),
          $variables: new SceneVariableSet({
            variables: [
              new CustomVariable({
                name: 'env',
                label: 'Environment',
                query: 'dev,staging,prod',
              }),
            ],
          }),
        }),
      ],
    });

    const serialized = serializeRowsLayout(rowsLayout);

    const rowSpec = serialized.spec as RowsLayoutSpec;
    expect(rowSpec.rows[0].spec.variables).toBeDefined();
    expect(rowSpec.rows[0].spec.variables).toHaveLength(1);
    expect(rowSpec.rows[0].spec.variables![0].kind).toBe('CustomVariable');
    expect(rowSpec.rows[0].spec.variables![0].spec.name).toBe('env');
  });

  it('should not include variables key when row has no section variables', () => {
    const rowsLayout = new RowsLayoutManager({
      rows: [
        new RowItem({
          title: 'Row without vars',
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

    const rowSpec = serialized.spec as RowsLayoutSpec;
    expect(rowSpec.rows[0].spec.variables).toBeUndefined();
  });

  it('keeps row annotations across save and load and omits an empty list', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Deploys',
              collapse: false,
              annotations: [sectionAnnotation('row-deploys')],
              layout: { kind: 'GridLayout', spec: { items: [] } },
            },
          },
        ],
      },
    };

    const deserialized = deserializeRowsLayout(layout, {}, false);
    const row = deserialized.state.rows[0];
    const data = row.state.$data;
    expect(data).toBeInstanceOf(DashboardDataLayerSet);
    expect(data instanceof DashboardDataLayerSet && data.state.annotationLayers[0].state.name).toBe('row-deploys');

    const serialized = serializeRowsLayout(deserialized);
    const rowSpec = serialized.spec as RowsLayoutSpec;
    expect(rowSpec.rows[0].spec.annotations).toHaveLength(1);
    expect(rowSpec.rows[0].spec.annotations![0].spec.name).toBe('row-deploys');

    const empty = deserializeRowsLayout(
      {
        kind: 'RowsLayout',
        spec: {
          rows: [
            {
              kind: 'RowsLayoutRow',
              spec: { title: 'Empty', collapse: false, layout: { kind: 'GridLayout', spec: { items: [] } } },
            },
          ],
        },
      },
      {},
      false
    );
    const emptySpec = serializeRowsLayout(empty).spec as RowsLayoutSpec;
    expect(emptySpec.rows[0].spec.annotations).toBeUndefined();
    expect(empty.state.rows[0].state.$data).toBeUndefined();
  });

  it('does not create live section layers when loading a snapshot', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Deploys',
              collapse: false,
              annotations: [sectionAnnotation('row-deploys')],
              layout: { kind: 'GridLayout', spec: { items: [] } },
            },
          },
        ],
      },
    };

    const deserialized = deserializeRowsLayout(layout, {}, false, undefined, true);
    expect(deserialized.state.rows[0].state.$data).toBeUndefined();
  });
});

function sectionAnnotation(name: string) {
  return {
    kind: 'AnnotationQuery' as const,
    spec: {
      name,
      enable: true,
      hide: false,
      iconColor: 'red',
      query: { kind: 'DataQuery' as const, group: 'grafana', version: 'v0', spec: {} },
    },
  };
}
