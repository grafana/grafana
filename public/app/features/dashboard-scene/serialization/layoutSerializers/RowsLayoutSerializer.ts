import { SceneObject } from '@grafana/scenes';
import { DashboardV2Spec, RowsLayoutRowKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';

import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowItemRepeaterBehavior } from '../../scene/layout-rows/RowItemRepeaterBehavior';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { LayoutManagerSerializer } from '../../scene/types/DashboardLayoutManager';

import { layoutSerializerRegistry } from './layoutSerializerRegistry';
import { getConditionalRendering, getLayout } from './utils';

export class RowsLayoutSerializer implements LayoutManagerSerializer {
  serialize(layoutManager: RowsLayoutManager): DashboardV2Spec['layout'] {
    return {
      kind: 'RowsLayout',
      spec: {
        rows: layoutManager.state.rows.map((row) => {
          const layout = getLayout(row.state.layout);
          const rowKind: RowsLayoutRowKind = {
            kind: 'RowsLayoutRow',
            spec: {
              title: row.state.title,
              collapse: row.state.collapse,
              layout: layout,
              fillScreen: row.state.fillScreen,
              hideHeader: row.state.hideHeader,
            },
          };

          const conditionalRenderingRootGroup = row.state.conditionalRendering?.serialize();
          // Only serialize the conditional rendering if it has items
          if (conditionalRenderingRootGroup?.spec.items.length) {
            rowKind.spec.conditionalRendering = conditionalRenderingRootGroup;
          }

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
        collapse: row.spec.collapse,
        hideHeader: row.spec.hideHeader,
        fillScreen: row.spec.fillScreen,
        $behaviors: behaviors,
        layout: layoutSerializerRegistry.get(layout.kind).serializer.deserialize(layout, elements, preload),
        conditionalRendering: getConditionalRendering(row),
      });
    });
    return new RowsLayoutManager({ rows });
  }
}
