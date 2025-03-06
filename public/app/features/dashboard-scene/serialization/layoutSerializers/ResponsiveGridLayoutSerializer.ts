import { SceneCSSGridLayout } from '@grafana/scenes';
import { DashboardV2Spec, ResponsiveGridLayoutItemKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';

import { ResponsiveGridItem } from '../../scene/layout-responsive-grid/ResponsiveGridItem';
import { ResponsiveGridLayoutManager } from '../../scene/layout-responsive-grid/ResponsiveGridLayoutManager';
import { DashboardLayoutManager, LayoutManagerSerializer } from '../../scene/types/DashboardLayoutManager';
import { getGridItemKeyForPanelId } from '../../utils/utils';

import { buildVizPanel } from './utils';

export class ResponsiveGridLayoutSerializer implements LayoutManagerSerializer {
  serialize(layoutManager: ResponsiveGridLayoutManager): DashboardV2Spec['layout'] {
    return {
      kind: 'ResponsiveGridLayout',
      spec: {
        col:
          layoutManager.state.layout.state.templateColumns?.toString() ??
          ResponsiveGridLayoutManager.defaultCSS.templateColumns,
        row: layoutManager.state.layout.state.autoRows?.toString() ?? ResponsiveGridLayoutManager.defaultCSS.autoRows,
        items: layoutManager.state.layout.state.children.map((child) => {
          if (!(child instanceof ResponsiveGridItem)) {
            throw new Error('Expected ResponsiveGridItem');
          }
          const layoutItem: ResponsiveGridLayoutItemKind = {
            kind: 'ResponsiveGridLayoutItem',
            spec: {
              element: {
                kind: 'ElementReference',
                name: child.state?.body?.state.key ?? 'DefaultName',
              },
            },
          };

          if (child.state.variableName) {
            layoutItem.spec.repeat = {
              mode: 'variable',
              value: child.state.variableName,
            };
          }

          return layoutItem;
        }),
      },
    };
  }

  deserialize(layout: DashboardV2Spec['layout'], elements: DashboardV2Spec['elements']): DashboardLayoutManager {
    if (layout.kind !== 'ResponsiveGridLayout') {
      throw new Error('Invalid layout kind');
    }

    const children = layout.spec.items.map((item) => {
      const panel = elements[item.spec.element.name];
      if (!panel) {
        throw new Error(`Panel with uid ${item.spec.element.name} not found in the dashboard elements`);
      }
      if (panel.kind !== 'Panel') {
        throw new Error(`Unsupported element kind: ${panel.kind}`);
      }
      return new ResponsiveGridItem({
        key: getGridItemKeyForPanelId(panel.spec.id),
        body: buildVizPanel(panel),
        variableName: item.spec.repeat?.value,
      });
    });

    return new ResponsiveGridLayoutManager({
      layout: new SceneCSSGridLayout({
        templateColumns: layout.spec.col,
        autoRows: layout.spec.row,
        children,
      }),
    });
  }
}
