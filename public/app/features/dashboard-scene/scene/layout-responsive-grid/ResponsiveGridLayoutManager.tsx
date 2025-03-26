import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { GRID_CELL_VMARGIN } from 'app/core/constants';
import { t } from 'app/core/internationalization';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { NewObjectAddedToCanvasEvent, ObjectRemovedFromCanvasEvent } from '../../edit-pane/shared';
import { joinCloneKeys } from '../../utils/clone';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import {
  forceRenderChildren,
  getGridItemKeyForPanelId,
  getPanelIdForVizPanel,
  getVizPanelKeyForPanelId,
} from '../../utils/utils';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { ResponsiveGridItem } from './ResponsiveGridItem';
import { ResponsiveGridLayout } from './ResponsiveGridLayout';
import { getEditOptions } from './ResponsiveGridLayoutManagerEditor';

interface ResponsiveGridLayoutManagerState extends SceneObjectState {
  layout: ResponsiveGridLayout;
  maxColumnCount: number;
  rowHeight: AutoGridRowHeight;
  columnWidth: AutoGridColumnWidth;
  fillScreen: boolean;
}

export type AutoGridColumnWidth = 'narrow' | 'standard' | 'wide' | 'custom' | number;
export type AutoGridRowHeight = 'short' | 'standard' | 'tall' | 'custom' | number;

export const AUTO_GRID_DEFAULT_MAX_COLUMN_COUNT = 3;
export const AUTO_GRID_DEFAULT_COLUMN_WIDTH = 'standard';
export const AUTO_GRID_DEFAULT_ROW_HEIGHT = 'standard';

export class ResponsiveGridLayoutManager
  extends SceneObjectBase<ResponsiveGridLayoutManagerState>
  implements DashboardLayoutManager
{
  public static Component = ResponsiveGridLayoutManagerRenderer;

  public readonly isDashboardLayoutManager = true;

  public static readonly descriptor: LayoutRegistryItem = {
    get name() {
      return t('dashboard.responsive-layout.name', 'Auto grid');
    },
    get description() {
      return t('dashboard.responsive-layout.description', 'Panels resize to fit and form uniform grids');
    },
    id: 'responsive-grid',
    createFromLayout: ResponsiveGridLayoutManager.createFromLayout,
    kind: 'ResponsiveGridLayout',
    isGridLayout: true,
  };

  public readonly descriptor = ResponsiveGridLayoutManager.descriptor;

  public constructor(state: Partial<ResponsiveGridLayoutManagerState>) {
    const maxColumnCount = state.maxColumnCount ?? AUTO_GRID_DEFAULT_MAX_COLUMN_COUNT;
    const columnWidth = state.columnWidth ?? AUTO_GRID_DEFAULT_COLUMN_WIDTH;
    const rowHeight = state.rowHeight ?? AUTO_GRID_DEFAULT_ROW_HEIGHT;
    const fillScreen = state.fillScreen ?? false;

    super({
      ...state,
      maxColumnCount,
      columnWidth,
      rowHeight,
      fillScreen,
      layout:
        state.layout ??
        new ResponsiveGridLayout({
          templateColumns: getTemplateColumnsTemplate(maxColumnCount, columnWidth),
          autoRows: getAutoRowsTemplate(rowHeight, fillScreen),
        }),
    });

    // @ts-ignore
    this.state.layout.getDragClassCancel = () => 'drag-cancel';
    this.state.layout.isDraggable = () => true;
  }

  public addPanel(vizPanel: VizPanel) {
    const panelId = dashboardSceneGraph.getNextPanelId(this);

    vizPanel.setState({ key: getVizPanelKeyForPanelId(panelId) });
    vizPanel.clearParent();

    this.state.layout.setState({
      children: [new ResponsiveGridItem({ body: vizPanel }), ...this.state.layout.state.children],
    });

    this.publishEvent(new NewObjectAddedToCanvasEvent(vizPanel), true);
  }

  public removePanel(panel: VizPanel) {
    const element = panel.parent;
    this.state.layout.setState({ children: this.state.layout.state.children.filter((child) => child !== element) });
    this.publishEvent(new ObjectRemovedFromCanvasEvent(panel), true);
  }

  public duplicate(): DashboardLayoutManager {
    return this.clone({
      key: undefined,
      layout: this.state.layout.clone({
        key: undefined,
        children: this.state.layout.state.children.map((child) =>
          child.clone({
            key: undefined,
            body: child.state.body.clone({
              key: getVizPanelKeyForPanelId(dashboardSceneGraph.getNextPanelId(child.state.body)),
            }),
          })
        ),
      }),
    });
  }

  public duplicatePanel(panel: VizPanel) {
    const gridItem = panel.parent;
    if (!(gridItem instanceof ResponsiveGridItem)) {
      console.error('Trying to duplicate a panel that is not inside a DashboardGridItem');
      return;
    }

    const newPanelId = dashboardSceneGraph.getNextPanelId(this);
    const grid = this.state.layout;

    const newPanel = panel.clone({
      key: getVizPanelKeyForPanelId(newPanelId),
    });

    const newGridItem = gridItem.clone({
      key: getGridItemKeyForPanelId(newPanelId),
      body: newPanel,
    });

    const sourceIndex = grid.state.children.indexOf(gridItem);
    const newChildren = [...grid.state.children];

    // insert after
    newChildren.splice(sourceIndex + 1, 0, newGridItem);

    grid.setState({ children: newChildren });

    this.publishEvent(new NewObjectAddedToCanvasEvent(newPanel), true);
  }

  public getVizPanels(): VizPanel[] {
    const panels: VizPanel[] = [];

    for (const child of this.state.layout.state.children) {
      if (child instanceof ResponsiveGridItem) {
        panels.push(child.state.body);
      }
    }

    return panels;
  }

  public editModeChanged(isEditing: boolean) {
    this.state.layout.setState({ isDraggable: isEditing });
    forceRenderChildren(this.state.layout, true);
  }

  public cloneLayout(ancestorKey: string, isSource: boolean): DashboardLayoutManager {
    return this.clone({
      layout: this.state.layout.clone({
        children: this.state.layout.state.children.map((gridItem) => {
          if (gridItem instanceof ResponsiveGridItem) {
            // Get the original panel ID from the gridItem's key
            const panelId = getPanelIdForVizPanel(gridItem.state.body);
            const gridItemKey = joinCloneKeys(ancestorKey, getGridItemKeyForPanelId(panelId));

            return gridItem.clone({
              key: gridItemKey,
              body: gridItem.state.body.clone({
                key: joinCloneKeys(gridItemKey, getVizPanelKeyForPanelId(panelId)),
              }),
            });
          }
          throw new Error('Unexpected child type');
        }),
      }),
    });
  }

  public getOptions(): OptionsPaneItemDescriptor[] {
    return getEditOptions(this);
  }

  public onMaxColumnCountChanged(maxColumnCount: number) {
    this.setState({ maxColumnCount: maxColumnCount });
    this.state.layout.setState({
      templateColumns: getTemplateColumnsTemplate(maxColumnCount, this.state.columnWidth),
    });
  }

  public onColumnWidthChanged(columnWidth: AutoGridColumnWidth) {
    if (columnWidth === 'custom') {
      columnWidth = getNamedColumWidthInPixels(this.state.columnWidth);
    }

    this.setState({ columnWidth: columnWidth });
    this.state.layout.setState({
      templateColumns: getTemplateColumnsTemplate(this.state.maxColumnCount, this.state.columnWidth),
    });
  }

  public onFillScreenChanged(fillScreen: boolean) {
    this.setState({ fillScreen });
    this.state.layout.setState({
      autoRows: getAutoRowsTemplate(this.state.rowHeight, fillScreen),
    });
  }

  public onRowHeightChanged(rowHeight: AutoGridRowHeight) {
    if (rowHeight === 'custom') {
      rowHeight = getNamedHeightInPixels(this.state.rowHeight);
    }

    this.setState({ rowHeight });
    this.state.layout.setState({
      autoRows: getAutoRowsTemplate(rowHeight, this.state.fillScreen),
    });
  }

  public static createEmpty(): ResponsiveGridLayoutManager {
    return new ResponsiveGridLayoutManager({});
  }

  public static createFromLayout(layout: DashboardLayoutManager): ResponsiveGridLayoutManager {
    const panels = layout.getVizPanels();
    const children: ResponsiveGridItem[] = [];

    for (let panel of panels) {
      children.push(new ResponsiveGridItem({ body: panel.clone() }));
    }

    const layoutManager = ResponsiveGridLayoutManager.createEmpty();
    layoutManager.state.layout.setState({ children });

    return layoutManager;
  }
}

function ResponsiveGridLayoutManagerRenderer({ model }: SceneComponentProps<ResponsiveGridLayoutManager>) {
  return <model.state.layout.Component model={model.state.layout} />;
}

export function getTemplateColumnsTemplate(maxColumnCount: number, columnWidth: AutoGridColumnWidth) {
  return `repeat(auto-fit, minmax(min(max(100% / ${maxColumnCount} - ${GRID_CELL_VMARGIN}px, ${getNamedColumWidthInPixels(columnWidth)}px), 100%), 1fr))`;
}

function getNamedColumWidthInPixels(columnWidth: AutoGridColumnWidth) {
  if (typeof columnWidth === 'number') {
    return columnWidth;
  }

  switch (columnWidth) {
    case 'narrow':
      return 192;
    case 'wide':
      return 768;
    case 'custom':
    case 'standard':
    default:
      return 448;
  }
}

function getNamedHeightInPixels(rowHeight: AutoGridRowHeight) {
  if (typeof rowHeight === 'number') {
    return rowHeight;
  }

  switch (rowHeight) {
    case 'short':
      return 128;
    case 'tall':
      return 512;
    case 'custom':
    case 'standard':
    default:
      return 320;
  }
}

export function getAutoRowsTemplate(rowHeight: AutoGridRowHeight, fillScreen: boolean) {
  const rowHeightPixels = getNamedHeightInPixels(rowHeight);
  const maxRowHeightValue = fillScreen ? 'auto' : `${rowHeightPixels}px`;
  return `minmax(${rowHeightPixels}px, ${maxRowHeightValue})`;
}
