import { SceneComponentProps, SceneCSSGridLayout, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { GRID_CELL_VMARGIN } from 'app/core/constants';
import { t } from 'app/core/internationalization';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { NewObjectAddedToCanvasEvent, ObjectRemovedFromCanvasEvent } from '../../edit-pane/shared';
import { joinCloneKeys } from '../../utils/clone';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getGridItemKeyForPanelId, getPanelIdForVizPanel, getVizPanelKeyForPanelId } from '../../utils/utils';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { ResponsiveGridItem } from './ResponsiveGridItem';
import { getEditOptions } from './ResponsiveGridLayoutManagerEditor';

interface ResponsiveGridLayoutManagerState extends SceneObjectState {
  layout: SceneCSSGridLayout;
  maxColumnCount: string;
  minColumnWidth: string;
  minRowHeight: string;
  maxRowHeight: string;
}

export const AUTO_GRID_DEFAULT_MAX_COLUMN_COUNT = '3';
export const AUTO_GRID_DEFAULT_MIN_COLUMN_WIDTH = '384';

export const AUTO_GRID_DEFAULT_MAX_ROW_HEIGHT = 'auto';
export const AUTO_GRID_DEFAULT_MIN_ROW_HEIGHT = '256';

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
    const minColumnWidth = state.minColumnWidth ?? AUTO_GRID_DEFAULT_MIN_COLUMN_WIDTH;
    const minRowHeight = state.minRowHeight ?? AUTO_GRID_DEFAULT_MIN_ROW_HEIGHT;
    const maxRowHeight = state.maxRowHeight ?? AUTO_GRID_DEFAULT_MAX_ROW_HEIGHT;

    super({
      ...state,
      maxColumnCount,
      minColumnWidth,
      minRowHeight,
      maxRowHeight,
      layout:
        state.layout ??
        new SceneCSSGridLayout({
          templateColumns: getTemplateColumnsTemplate(maxColumnCount, minColumnWidth),
          autoRows: getAutoRowsTemplate(minRowHeight, maxRowHeight),
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

  public onMaxColumnCountChanged(maxColumnCount: string) {
    this.setState({ maxColumnCount: maxColumnCount });
    this.state.layout.setState({
      templateColumns: getTemplateColumnsTemplate(maxColumnCount, this.state.minColumnWidth),
    });
  }

  public onMinColumnWidthChanged(minColumnWidth: string) {
    this.setState({ minColumnWidth: minColumnWidth });
    this.state.layout.setState({
      templateColumns: getTemplateColumnsTemplate(this.state.maxColumnCount, this.state.minColumnWidth),
    });
  }

  public onMaxRowHeightChanged(maxRowHeight: string) {
    this.setState({ maxRowHeight });
    this.state.layout.setState({
      autoRows: getAutoRowsTemplate(this.state.minRowHeight, maxRowHeight),
    });
  }

  public onMinRowHeightChanged(minRowHeight: string) {
    this.setState({ minRowHeight });
    this.state.layout.setState({
      autoRows: getAutoRowsTemplate(minRowHeight, this.state.maxRowHeight),
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

function getTemplateColumnsTemplate(maxColumnCount: string, minColumnWidth: string) {
  return `repeat(auto-fit, minmax(min(max(100% / ${maxColumnCount} - ${GRID_CELL_VMARGIN}px, ${minColumnWidth}px), 100%), 1fr))`;
}

function getAutoRowsTemplate(minRowHeight: string, maxRowHeight: string) {
  const maxRowHeightValue = maxRowHeight === 'auto' ? 'auto' : `${maxRowHeight}px`;
  return `minmax(${minRowHeight}px, ${maxRowHeightValue})`;
}
