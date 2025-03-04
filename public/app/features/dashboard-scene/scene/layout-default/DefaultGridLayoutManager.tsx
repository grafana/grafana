import { config } from '@grafana/runtime';
import {
  SceneObjectState,
  SceneGridLayout,
  SceneObjectBase,
  SceneGridRow,
  VizPanel,
  sceneGraph,
  sceneUtils,
  SceneComponentProps,
  SceneGridItemLike,
  useSceneObjectState,
} from '@grafana/scenes';
import { GRID_COLUMN_COUNT } from 'app/core/constants';
import { t } from 'app/core/internationalization';
import DashboardEmpty from 'app/features/dashboard/dashgrid/DashboardEmpty';

import { isClonedKey, joinCloneKeys } from '../../utils/clone';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import {
  forceRenderChildren,
  getPanelIdForVizPanel,
  NEW_PANEL_HEIGHT,
  NEW_PANEL_WIDTH,
  getVizPanelKeyForPanelId,
  getGridItemKeyForPanelId,
  getDashboardSceneFor,
} from '../../utils/utils';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { DashboardGridItem } from './DashboardGridItem';
import { RowRepeaterBehavior } from './RowRepeaterBehavior';
import { RowActions } from './row-actions/RowActions';

interface DefaultGridLayoutManagerState extends SceneObjectState {
  grid: SceneGridLayout;
}

export class DefaultGridLayoutManager
  extends SceneObjectBase<DefaultGridLayoutManagerState>
  implements DashboardLayoutManager
{
  public static Component = DefaultGridLayoutManagerRenderer;

  public readonly isDashboardLayoutManager = true;

  public static readonly descriptor: LayoutRegistryItem = {
    get name() {
      return t('dashboard.default-layout.name', 'Default grid');
    },
    get description() {
      return t('dashboard.default-layout.description', 'The default grid layout');
    },
    id: 'default-grid',
    createFromLayout: DefaultGridLayoutManager.createFromLayout,
    kind: 'GridLayout',
  };

  public readonly descriptor = DefaultGridLayoutManager.descriptor;

  public addPanel(vizPanel: VizPanel) {
    const panelId = dashboardSceneGraph.getNextPanelId(this);

    vizPanel.setState({ key: getVizPanelKeyForPanelId(panelId) });
    vizPanel.clearParent();

    const newGridItem = new DashboardGridItem({
      height: NEW_PANEL_HEIGHT,
      width: NEW_PANEL_WIDTH,
      x: 0,
      y: 0,
      body: vizPanel,
      key: getGridItemKeyForPanelId(panelId),
    });

    this.state.grid.setState({
      children: [newGridItem, ...this.state.grid.state.children],
    });
  }

  public removePanel(panel: VizPanel) {
    const gridItem = panel.parent!;

    if (!(gridItem instanceof DashboardGridItem)) {
      throw new Error('Trying to remove panel that is not inside a DashboardGridItem');
    }

    const layout = this.state.grid;

    let row: SceneGridRow | undefined;

    try {
      row = sceneGraph.getAncestor(gridItem, SceneGridRow);
    } catch {
      row = undefined;
    }

    if (row) {
      row.setState({ children: row.state.children.filter((child) => child !== gridItem) });
      layout.forceRender();
      return;
    }

    this.state.grid.setState({
      children: layout.state.children.filter((child) => child !== gridItem),
    });
  }

  public duplicatePanel(vizPanel: VizPanel) {
    const gridItem = vizPanel.parent;
    if (!(gridItem instanceof DashboardGridItem)) {
      console.error('Trying to duplicate a panel that is not inside a DashboardGridItem');
      return;
    }

    let panelState;
    let panelData;
    let newGridItem;

    const newPanelId = dashboardSceneGraph.getNextPanelId(this);
    const grid = this.state.grid;

    if (gridItem instanceof DashboardGridItem) {
      panelState = sceneUtils.cloneSceneObjectState(gridItem.state.body.state);
      panelData = sceneGraph.getData(gridItem.state.body).clone();
    } else {
      panelState = sceneUtils.cloneSceneObjectState(vizPanel.state);
      panelData = sceneGraph.getData(vizPanel).clone();
    }

    // when we duplicate a panel we don't want to clone the alert state
    delete panelData.state.data?.alertState;

    newGridItem = new DashboardGridItem({
      x: gridItem.state.x,
      y: gridItem.state.y,
      height: gridItem.state.height,
      itemHeight: gridItem.state.height,
      width: gridItem.state.width,
      variableName: gridItem.state.variableName,
      repeatDirection: gridItem.state.repeatDirection,
      maxPerRow: gridItem.state.maxPerRow,
      key: getGridItemKeyForPanelId(newPanelId),
      body: new VizPanel({ ...panelState, $data: panelData, key: getVizPanelKeyForPanelId(newPanelId) }),
    });

    if (gridItem.parent instanceof SceneGridRow) {
      const row = gridItem.parent;

      row.setState({ children: [...row.state.children, newGridItem] });

      grid.forceRender();
      return;
    }

    grid.setState({ children: [...grid.state.children, newGridItem] });
  }

  public getVizPanels(): VizPanel[] {
    const panels: VizPanel[] = [];

    this.state.grid.forEachChild((child) => {
      if (!(child instanceof DashboardGridItem) && !(child instanceof SceneGridRow)) {
        throw new Error('Child is not a DashboardGridItem or SceneGridRow, invalid scene');
      }

      if (child instanceof DashboardGridItem && child.state.body instanceof VizPanel) {
        panels.push(child.state.body);
      } else if (child instanceof SceneGridRow) {
        child.forEachChild((child) => {
          if (child instanceof DashboardGridItem && child.state.body instanceof VizPanel) {
            panels.push(child.state.body);
          }
        });
      }
    });

    return panels;
  }

  public hasVizPanels(): boolean {
    for (const child of this.state.grid.state.children) {
      if (child instanceof DashboardGridItem) {
        return true;
      } else if (child instanceof SceneGridRow) {
        for (const rowChild of child.state.children) {
          if (rowChild instanceof DashboardGridItem) {
            return true;
          }
        }
      }
    }

    return false;
  }

  public addNewRow(): SceneGridRow {
    const id = dashboardSceneGraph.getNextPanelId(this);

    const row = new SceneGridRow({
      key: getVizPanelKeyForPanelId(id),
      title: 'Row title',
      actions: new RowActions({}),
      y: 0,
    });

    const sceneGridLayout = this.state.grid;

    // find all panels until the first row and put them into the newly created row. If there are no other rows,
    // add all panels to the row. If there are no panels just create an empty row
    const indexTillNextRow = sceneGridLayout.state.children.findIndex((child) => child instanceof SceneGridRow);
    const rowChildren = sceneGridLayout.state.children
      .splice(0, indexTillNextRow === -1 ? sceneGridLayout.state.children.length : indexTillNextRow)
      .map((child) => child.clone());

    if (rowChildren) {
      row.setState({ children: rowChildren });
    }

    sceneGridLayout.setState({ children: [row, ...sceneGridLayout.state.children] });

    return row;
  }

  public addNewTab() {
    const shouldAddTab = this.hasVizPanels();
    const tabsLayout = TabsLayoutManager.createFromLayout(this);

    if (shouldAddTab) {
      tabsLayout.addNewTab();
    }

    getDashboardSceneFor(this).switchLayout(tabsLayout);
  }

  public editModeChanged(isEditing: boolean) {
    const updateResizeAndDragging = () => {
      this.state.grid.setState({ isDraggable: isEditing, isResizable: isEditing });
      forceRenderChildren(this.state.grid, true);
    };

    if (config.featureToggles.dashboardNewLayouts) {
      // We do this in a timeout to wait a bit with enabling dragging as dragging enables grid animations
      // if we show the edit pane without animations it opens much faster and feels more responsive
      setTimeout(updateResizeAndDragging, 10);
      return;
    }

    updateResizeAndDragging();
  }

  public activateRepeaters() {
    if (!this.isActive) {
      this.activate();
    }

    if (!this.state.grid.isActive) {
      this.state.grid.activate();
    }

    this.state.grid.forEachChild((child) => {
      if (child instanceof DashboardGridItem && !child.isActive) {
        child.activate();
        return;
      }

      if (child instanceof SceneGridRow && child.state.$behaviors) {
        for (const behavior of child.state.$behaviors) {
          if (behavior instanceof RowRepeaterBehavior && !child.isActive) {
            child.activate();
            break;
          }
        }

        child.state.children.forEach((child) => {
          if (child instanceof DashboardGridItem && !child.isActive) {
            child.activate();
            return;
          }
        });
      }
    });
  }

  public cloneLayout(ancestorKey: string, isSource: boolean): DashboardLayoutManager {
    return this.clone({
      grid: this.state.grid.clone({
        isResizable: isSource && this.state.grid.state.isResizable,
        isDraggable: isSource && this.state.grid.state.isDraggable,
        children: this.state.grid.state.children.reduce<{ panelId: number; children: SceneGridItemLike[] }>(
          (childrenAcc, child) => {
            if (child instanceof DashboardGridItem) {
              const gridItemKey = joinCloneKeys(ancestorKey, getGridItemKeyForPanelId(childrenAcc.panelId));

              const gridItem = child.clone({
                key: gridItemKey,
                body: child.state.body.clone({
                  key: joinCloneKeys(gridItemKey, getVizPanelKeyForPanelId(childrenAcc.panelId++)),
                }),
                isDraggable: isSource && child.state.isDraggable,
                isResizable: isSource && child.state.isResizable,
              });

              childrenAcc.children.push(gridItem);

              return childrenAcc;
            }

            if (child instanceof SceneGridRow) {
              const rowKey = joinCloneKeys(ancestorKey, getVizPanelKeyForPanelId(childrenAcc.panelId++));

              const row = child.clone({
                key: rowKey,
                children: child.state.children.reduce<SceneGridItemLike[]>((rowAcc, rowChild) => {
                  if (isClonedKey(rowChild.state.key!)) {
                    return rowAcc;
                  }

                  if (!(rowChild instanceof DashboardGridItem)) {
                    rowAcc.push(rowChild.clone());
                    return rowAcc;
                  }

                  const gridItemKey = joinCloneKeys(rowKey, getGridItemKeyForPanelId(childrenAcc.panelId));

                  const gridItem = rowChild.clone({
                    key: gridItemKey,
                    isDraggable: isSource && rowChild.state.isDraggable,
                    isResizable: isSource && rowChild.state.isResizable,
                    body: rowChild.state.body.clone({
                      key: joinCloneKeys(gridItemKey, getVizPanelKeyForPanelId(childrenAcc.panelId++)),
                    }),
                  });

                  rowAcc.push(gridItem);
                  return rowAcc;
                }, []),
                isDraggable: isSource && child.state.isDraggable,
                isResizable: isSource && child.state.isResizable,
              });

              childrenAcc.children.push(row);

              return childrenAcc;
            }

            childrenAcc.children.push(child.clone());

            return childrenAcc;
          },
          { panelId: 0, children: [] }
        ).children,
      }),
    });
  }

  public removeRow(row: SceneGridRow, removePanels = false) {
    const sceneGridLayout = this.state.grid;

    const children = sceneGridLayout.state.children.filter((child) => child.state.key !== row.state.key);

    if (!removePanels) {
      const rowChildren = row.state.children.map((child) => child.clone());
      const indexOfRow = sceneGridLayout.state.children.findIndex((child) => child.state.key === row.state.key);

      children.splice(indexOfRow, 0, ...rowChildren);
    }

    sceneGridLayout.setState({ children });
  }

  public collapseAllRows() {
    this.state.grid.state.children.forEach((child) => {
      if (!(child instanceof SceneGridRow)) {
        return;
      }

      if (!child.state.isCollapsed) {
        this.state.grid.toggleRow(child);
      }
    });
  }

  public expandAllRows() {
    this.state.grid.state.children.forEach((child) => {
      if (!(child instanceof SceneGridRow)) {
        return;
      }

      if (child.state.isCollapsed) {
        this.state.grid.toggleRow(child);
      }
    });
  }

  public static createFromLayout(currentLayout: DashboardLayoutManager): DefaultGridLayoutManager {
    const panels = currentLayout.getVizPanels();
    return DefaultGridLayoutManager.fromVizPanels(panels);
  }

  public static fromVizPanels(panels: VizPanel[] = []): DefaultGridLayoutManager {
    const children: DashboardGridItem[] = [];
    const panelHeight = 10;
    const panelWidth = GRID_COLUMN_COUNT / 3;
    let currentY = 0;
    let currentX = 0;

    for (let panel of panels) {
      panel.clearParent();

      children.push(
        new DashboardGridItem({
          key: getGridItemKeyForPanelId(getPanelIdForVizPanel(panel)),
          x: currentX,
          y: currentY,
          width: panelWidth,
          height: panelHeight,
          body: panel,
        })
      );

      currentX += panelWidth;

      if (currentX + panelWidth >= GRID_COLUMN_COUNT) {
        currentX = 0;
        currentY += panelHeight;
      }
    }

    return new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: children,
        isDraggable: true,
        isResizable: true,
      }),
    });
  }

  public static fromGridItems(
    gridItems: SceneGridItemLike[],
    isDraggable?: boolean,
    isResizable?: boolean
  ): DefaultGridLayoutManager {
    const children = gridItems.reduce<SceneGridItemLike[]>((acc, gridItem) => {
      gridItem.clearParent();
      acc.push(gridItem);

      return acc;
    }, []);

    return new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children,
        isDraggable,
        isResizable,
      }),
    });
  }
}

function DefaultGridLayoutManagerRenderer({ model }: SceneComponentProps<DefaultGridLayoutManager>) {
  const { children } = useSceneObjectState(model.state.grid, { shouldActivateOrKeepAlive: true });
  const dashboard = getDashboardSceneFor(model);

  // If we are top level layout and have no children, show empty state
  if (model.parent === dashboard && children.length === 0) {
    return (
      <DashboardEmpty dashboard={dashboard} canCreate={!!dashboard.state.meta.canEdit} key="dashboard-empty-state" />
    );
  }

  return <model.state.grid.Component model={model.state.grid} />;
}
