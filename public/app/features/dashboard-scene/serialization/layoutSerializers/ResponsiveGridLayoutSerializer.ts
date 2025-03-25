import {
  DashboardV2Spec,
  defaultResponsiveGridLayoutSpec,
  ResponsiveGridLayoutItemKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';

import { ResponsiveGridItem } from '../../scene/layout-responsive-grid/ResponsiveGridItem';
import { ResponsiveGridLayout } from '../../scene/layout-responsive-grid/ResponsiveGridLayout';
import {
  AUTO_GRID_DEFAULT_COLUMN_WIDTH,
  AUTO_GRID_DEFAULT_MAX_COLUMN_COUNT,
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
    const defaults = defaultResponsiveGridLayoutSpec();
    const { maxColumnCount, columnWidth, rowHeight, fillScreen, layout } = layoutManager.state;

    return {
      kind: 'ResponsiveGridLayout',
      spec: {
        maxColumnCount: maxColumnCount === defaults.maxColumnCount ? undefined : maxColumnCount,
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

    const defaults = defaultResponsiveGridLayoutSpec();
    const columnWidthMode = layout.spec.columnWidthMode ?? defaults.columnWidthMode;
    const rowHeightMode = layout.spec.rowHeightMode ?? defaults.rowHeightMode;
    const maxColumnCount = layout.spec.maxColumnCount ?? defaults.maxColumnCount;

    return new ResponsiveGridLayoutManager({
      maxColumnCount,
      columnWidth: columnWidthMode === 'custom' ? layout.spec.columnWidth : layout.spec.columnWidthMode,
      rowHeight: rowHeightMode === 'custom' ? layout.spec.rowHeight : layout.spec.rowHeightMode,
      fillScreen: layout.spec.fillScreen,
      layout: new ResponsiveGridLayout({
        templateColumns: getTemplateColumnsTemplate(
          layout.spec.maxColumnCount ?? AUTO_GRID_DEFAULT_MAX_COLUMN_COUNT,
          layout.spec.columnWidth ?? AUTO_GRID_DEFAULT_COLUMN_WIDTH
        ),
        autoRows: getAutoRowsTemplate(
          layout.spec.rowHeight ?? AUTO_GRID_DEFAULT_ROW_HEIGHT,
          layout.spec.fillScreen ?? false
        ),
        children,
      }),
    });
  }
}

function serializeAutoGridColumnWidth(columnWidth: AutoGridColumnWidth) {
  if (columnWidth === 'standard') {
    return {};
  }

  return {
    columnWidthMode: typeof columnWidth === 'number' ? 'custom' : columnWidth,
    columnWidth: typeof columnWidth === 'number' ? columnWidth : undefined,
  };
}

function serializeAutoGridRowHeight(rowHeight: AutoGridRowHeight) {
  if (rowHeight === 'standard') {
    return {};
  }

  return {
    rowHeightMode: typeof rowHeight === 'number' ? 'custom' : rowHeight,
    rowHeight: typeof rowHeight === 'number' ? rowHeight : undefined,
  };
}
