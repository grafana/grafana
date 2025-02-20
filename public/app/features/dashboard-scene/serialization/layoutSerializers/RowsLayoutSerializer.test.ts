import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';

import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { ResponsiveGridLayoutManager } from '../../scene/layout-responsive-grid/ResponsiveGridLayoutManager';
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
              layout: { kind: 'ResponsiveGridLayout', spec: { row: '', col: '', items: [] } },
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
              layout: { kind: 'ResponsiveGridLayout', spec: { row: '', col: '', items: [] } },
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
});
