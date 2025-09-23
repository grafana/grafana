import { SceneObject } from '@grafana/scenes';
import { DashboardV2Spec, RowsLayoutRowKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';

import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowItemRepeaterBehavior } from '../../scene/layout-rows/RowItemRepeaterBehavior';
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
          const rowKind: RowsLayoutRowKind = {
            kind: 'RowsLayoutRow',
            spec: {
              title: row.state.title,
              collapsed: row.state.isCollapsed ?? false,
              layout: layout,
            },
          };

          if (row.state.$behaviors) {
            for (const behavior of row.state.$behaviors) {
              if (behavior instanceof RowItemRepeaterBehavior) {
                if (rowKind.spec.repeat) {
                  throw new Error('Multiple repeaters are not supported');
                }
                rowKind.spec.repeat = { value: behavior.state.variableName, mode: 'variable' };
              }
            }
          }
          return rowKind;
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
      const behaviors: SceneObject[] = [];
      if (row.spec.repeat) {
        behaviors.push(new RowItemRepeaterBehavior({ variableName: row.spec.repeat.value }));
      }
      return new RowItem({
        title: row.spec.title,
        isCollapsed: row.spec.collapsed,
        $behaviors: behaviors,
        layout: layoutSerializerRegistry.get(layout.kind).serializer.deserialize(layout, elements, preload),
      });
    });
    return new RowsLayoutManager({ rows });
  }
}
