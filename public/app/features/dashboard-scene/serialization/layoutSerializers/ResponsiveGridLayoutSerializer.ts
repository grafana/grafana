import {
  DashboardV2Spec,
  defaultAutoGridLayoutSpec,
  AutoGridLayoutItemKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';

import { AutoGridItem } from '../../scene/layout-responsive-grid/ResponsiveGridItem';
import { AutoGridLayout } from '../../scene/layout-responsive-grid/ResponsiveGridLayout';
import {
  AUTO_GRID_DEFAULT_COLUMN_WIDTH,
  AUTO_GRID_DEFAULT_ROW_HEIGHT,
  AutoGridColumnWidth,
  AutoGridRowHeight,
  getAutoRowsTemplate,
  getTemplateColumnsTemplate,
  AutoGridLayoutManager,
} from '../../scene/layout-responsive-grid/ResponsiveGridLayoutManager';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getGridItemKeyForPanelId } from '../../utils/utils';

import { buildLibraryPanel, buildVizPanel, getConditionalRendering } from './utils';

export function serializeAutoGridLayout(layoutManager: AutoGridLayoutManager): DashboardV2Spec['layout'] {
  const { maxColumnCount, fillScreen, columnWidth, rowHeight, layout } = layoutManager.state;
  const defaults = defaultAutoGridLayoutSpec();

  return {
    kind: 'AutoGridLayout',
    spec: {
      maxColumnCount,
      fillScreen: fillScreen === defaults.fillScreen ? undefined : fillScreen,
      ...serializeAutoGridColumnWidth(columnWidth),
      ...serializeAutoGridRowHeight(rowHeight),
      items: layout.state.children.map((child) => {
        if (!(child instanceof AutoGridItem)) {
          throw new Error('Expected AutoGridItem');
        }
        // For serialization we should retrieve the original element key
        const elementKey = dashboardSceneGraph.getElementIdentifierForVizPanel(child.state?.body);

        const layoutItem: AutoGridLayoutItemKind = {
          kind: 'AutoGridLayoutItem',
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

export function deserializeAutoGridLayout(
  layout: DashboardV2Spec['layout'],
  elements: DashboardV2Spec['elements']
): AutoGridLayoutManager {
  if (layout.kind !== 'AutoGridLayout') {
    throw new Error('Invalid layout kind');
  }

  const defaults = defaultAutoGridLayoutSpec();
  const { maxColumnCount, columnWidthMode, columnWidth, rowHeightMode, rowHeight, fillScreen } = layout.spec;

  const children = layout.spec.items.map((item) => {
    const panel = elements[item.spec.element.name];
    if (!panel) {
      throw new Error(`Panel with uid ${item.spec.element.name} not found in the dashboard elements`);
    }
    return new AutoGridItem({
      key: getGridItemKeyForPanelId(panel.spec.id),
      body: panel.kind === 'LibraryPanel' ? buildLibraryPanel(panel) : buildVizPanel(panel),
      variableName: item.spec.repeat?.value,
      conditionalRendering: getConditionalRendering(item),
    });
  });

  const columnWidthCombined = columnWidthMode === 'custom' ? columnWidth : columnWidthMode;
  const rowHeightCombined = rowHeightMode === 'custom' ? rowHeight : rowHeightMode;

  return new AutoGridLayoutManager({
    maxColumnCount,
    columnWidth: columnWidthCombined,
    rowHeight: rowHeightCombined,
    fillScreen: fillScreen ?? defaults.fillScreen,
    layout: new AutoGridLayout({
      templateColumns: getTemplateColumnsTemplate(
        maxColumnCount ?? defaults.maxColumnCount!,
        columnWidthCombined ?? AUTO_GRID_DEFAULT_COLUMN_WIDTH
      ),
      autoRows: getAutoRowsTemplate(rowHeightCombined ?? AUTO_GRID_DEFAULT_ROW_HEIGHT, fillScreen ?? false),
      children,
    }),
  });
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
