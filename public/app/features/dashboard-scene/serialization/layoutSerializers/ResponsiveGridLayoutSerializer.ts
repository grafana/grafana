import {
  DashboardV2Spec,
  defaultResponsiveGridLayoutSpec,
  ResponsiveGridLayoutItemKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';

import { ResponsiveGridItem } from '../../scene/layout-responsive-grid/ResponsiveGridItem';
import { ResponsiveGridLayout } from '../../scene/layout-responsive-grid/ResponsiveGridLayout';
import {
  AUTO_GRID_DEFAULT_COLUMN_WIDTH,
  AUTO_GRID_DEFAULT_ROW_HEIGHT,
  AutoGridColumnWidth,
  AutoGridRowHeight,
  getAutoRowsTemplate,
  getTemplateColumnsTemplate,
  ResponsiveGridLayoutManager,
} from '../../scene/layout-responsive-grid/ResponsiveGridLayoutManager';
import { DashboardLayoutManager, LayoutManagerSerializer } from '../../scene/types/DashboardLayoutManager';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getGridItemKeyForPanelId } from '../../utils/utils';

import { buildLibraryPanel, buildVizPanel, getConditionalRendering } from './utils';

export class ResponsiveGridLayoutSerializer implements LayoutManagerSerializer {
  serialize(layoutManager: ResponsiveGridLayoutManager): DashboardV2Spec['layout'] {
    const { maxColumnCount, fillScreen, columnWidth, rowHeight, layout } = layoutManager.state;
    const defaults = defaultResponsiveGridLayoutSpec();

    return {
      kind: 'ResponsiveGridLayout',
      spec: {
        maxColumnCount,
        fillScreen: fillScreen === defaults.fillScreen ? undefined : fillScreen,
        ...serializeAutoGridColumnWidth(columnWidth),
        ...serializeAutoGridRowHeight(rowHeight),
        items: layout.state.children.map((child) => {
          if (!(child instanceof ResponsiveGridItem)) {
            throw new Error('Expected ResponsiveGridItem');
          }
          // For serialization we should retrieve the original element key
          const elementKey = dashboardSceneGraph.getElementIdentifierForVizPanel(child.state?.body);

          const layoutItem: ResponsiveGridLayoutItemKind = {
            kind: 'ResponsiveGridLayoutItem',
            spec: {
              element: {
                kind: 'ElementReference',
                name: elementKey,
              },
            },
          };

          const conditionalRenderingRootGroup = child.state.conditionalRendering?.serialize();
          // Only serialize the conditional rendering if it has items
          if (conditionalRenderingRootGroup?.spec.items.length) {
            layoutItem.spec.conditionalRendering = conditionalRenderingRootGroup;
          }

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

    const defaults = defaultResponsiveGridLayoutSpec();
    const { maxColumnCount, columnWidthMode, columnWidth, rowHeightMode, rowHeight, fillScreen } = layout.spec;

    const children = layout.spec.items.map((item) => {
      const panel = elements[item.spec.element.name];
      if (!panel) {
        throw new Error(`Panel with uid ${item.spec.element.name} not found in the dashboard elements`);
      }
      return new ResponsiveGridItem({
        key: getGridItemKeyForPanelId(panel.spec.id),
        body: panel.kind === 'LibraryPanel' ? buildLibraryPanel(panel) : buildVizPanel(panel),
        variableName: item.spec.repeat?.value,
        conditionalRendering: getConditionalRendering(item),
      });
    });

    const columnWidthCombined = columnWidthMode === 'custom' ? columnWidth : columnWidthMode;
    const rowHeightCombined = rowHeightMode === 'custom' ? rowHeight : rowHeightMode;

    return new ResponsiveGridLayoutManager({
      maxColumnCount,
      columnWidth: columnWidthCombined,
      rowHeight: rowHeightCombined,
      fillScreen: fillScreen ?? defaults.fillScreen,
      layout: new ResponsiveGridLayout({
        templateColumns: getTemplateColumnsTemplate(
          maxColumnCount ?? defaults.maxColumnCount!,
          columnWidthCombined ?? AUTO_GRID_DEFAULT_COLUMN_WIDTH
        ),
        autoRows: getAutoRowsTemplate(rowHeightCombined ?? AUTO_GRID_DEFAULT_ROW_HEIGHT, fillScreen ?? false),
        children,
      }),
    });
  }
}

function serializeAutoGridColumnWidth(columnWidth: AutoGridColumnWidth) {
  return {
    columnWidthMode: typeof columnWidth === 'number' ? 'custom' : columnWidth,
    columnWidth: typeof columnWidth === 'number' ? columnWidth : undefined,
  };
}

function serializeAutoGridRowHeight(rowHeight: AutoGridRowHeight) {
  return {
    rowHeightMode: typeof rowHeight === 'number' ? 'custom' : rowHeight,
    rowHeight: typeof rowHeight === 'number' ? rowHeight : undefined,
  };
}
