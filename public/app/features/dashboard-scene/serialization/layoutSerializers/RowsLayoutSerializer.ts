import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';

import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { LayoutManagerSerializer } from '../../scene/types/DashboardLayoutManager';

import { layoutSerializerRegistry } from './layoutSerializerRegistry';
import { getLayout } from './utils';

export class RowsLayoutSerializer implements LayoutManagerSerializer {
  serialize(layoutManager: RowsLayoutManager): DashboardV2Spec['layout'] {
    return {
      kind: 'RowsLayout',
      spec: {
        rows: layoutManager.state.rows.map((row) => {
          const layout = getLayout(row.state.layout);
          if (layout.kind === 'RowsLayout') {
            throw new Error('Nested RowsLayout is not supported');
          }
          return {
            kind: 'RowsLayoutRow',
            spec: {
              title: row.state.title,
              collapsed: row.state.isCollapsed ?? false,
              layout: layout,
            },
          };
        }),
      },
    };
  }

  deserialize(
    layout: DashboardV2Spec['layout'],
    elements: DashboardV2Spec['elements'],
    preload: boolean
  ): RowsLayoutManager {
    if (layout.kind !== 'RowsLayout') {
      throw new Error('Invalid layout kind');
    }
    const rows = layout.spec.rows.map((row) => {
      const layout = row.spec.layout;
      return new RowItem({
        title: row.spec.title,
        isCollapsed: row.spec.collapsed,
        layout: layoutSerializerRegistry.get(layout.kind).serializer.deserialize(layout, elements, preload),
      });
    });
    return new RowsLayoutManager({ rows });
  }
}
