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
} from '@grafana/scenes';
import { GRID_COLUMN_COUNT } from 'app/core/constants';

import {
  forceRenderChildren,
  getPanelIdForVizPanel,
  NEW_PANEL_HEIGHT,
  NEW_PANEL_WIDTH,
  getVizPanelKeyForPanelId,
} from '../../utils/utils';
import { RowRepeaterBehavior } from '../RowRepeaterBehavior';
import { RowActions } from '../row-actions/RowActions';
import { DashboardLayoutManager, LayoutRegistryItem } from '../types';

import { DashboardGridItem } from './DashboardGridItem';

interface DefaultGridLayoutManagerState extends SceneObjectState {
  grid: SceneGridLayout;
}

/**
 * State manager for the default grid layout
 */
export class DefaultGridLayoutManager
  extends SceneObjectBase<DefaultGridLayoutManagerState>
  implements DashboardLayoutManager
{
  public isDashboardLayoutManager: true = true;

  public editModeChanged(isEditing: boolean): void {
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

  public addPanel(vizPanel: VizPanel): void {
    const panelId = this.getNextPanelId();

    vizPanel.setState({ key: getVizPanelKeyForPanelId(panelId) });
    vizPanel.clearParent();

    const newGridItem = new DashboardGridItem({
      height: NEW_PANEL_HEIGHT,
      width: NEW_PANEL_WIDTH,
      x: 0,
      y: 0,
      body: vizPanel,
      key: `grid-item-${panelId}`,
    });

    this.state.grid.setState({
      children: [newGridItem, ...this.state.grid.state.children],
    });
  }

  /**
   * Adds a new emtpy row
   */
  public addNewRow(): SceneGridRow {
    const id = this.getNextPanelId();
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

  /**
   * Removes a row
   * @param row
   * @param removePanels
   */
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

  /**
   * Removes a panel
   */
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

  public duplicatePanel(vizPanel: VizPanel): void {
    const gridItem = vizPanel.parent;
    if (!(gridItem instanceof DashboardGridItem)) {
      console.error('Trying to duplicate a panel that is not inside a DashboardGridItem');
      return;
    }

    let panelState;
    let panelData;
    let newGridItem;

    const newPanelId = this.getNextPanelId();
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
      key: `grid-item-${newPanelId}`,
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

      if (child instanceof DashboardGridItem) {
        if (child.state.body instanceof VizPanel) {
          panels.push(child.state.body);
        }
      } else if (child instanceof SceneGridRow) {
        child.forEachChild((child) => {
          if (child instanceof DashboardGridItem) {
            if (child.state.body instanceof VizPanel) {
              panels.push(child.state.body);
            }
          }
        });
      }
    });

    return panels;
  }

  public getNextPanelId(): number {
    let max = 0;

    for (const child of this.state.grid.state.children) {
      if (child instanceof DashboardGridItem) {
        const vizPanel = child.state.body;

        if (vizPanel) {
          const panelId = getPanelIdForVizPanel(vizPanel);

          if (panelId > max) {
            max = panelId;
          }
        }
      }

      if (child instanceof SceneGridRow) {
        //rows follow the same key pattern --- e.g.: `panel-6`
        const panelId = getPanelIdForVizPanel(child);

        if (panelId > max) {
          max = panelId;
        }

        for (const rowChild of child.state.children) {
          if (rowChild instanceof DashboardGridItem) {
            const vizPanel = rowChild.state.body;

            if (vizPanel) {
              const panelId = getPanelIdForVizPanel(vizPanel);

              if (panelId > max) {
                max = panelId;
              }
            }
          }
        }
      }
    }

    return max + 1;
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

  activateRepeaters(): void {
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

  public getDescriptor(): LayoutRegistryItem {
    return DefaultGridLayoutManager.getDescriptor();
  }

  public static getDescriptor(): LayoutRegistryItem {
    return {
      name: 'Default grid',
      description: 'The default grid layout',
      id: 'default-grid',
      createFromLayout: DefaultGridLayoutManager.createFromLayout,
    };
  }

  /**
   * Handle switching to the manual grid layout from other layouts
   * @param currentLayout
   * @returns
   */
  public static createFromLayout(currentLayout: DashboardLayoutManager): DefaultGridLayoutManager {
    const panels = currentLayout.getVizPanels();
    return DefaultGridLayoutManager.fromVizPanels(panels);
  }

  /**
   * For simple test grids
   * @param panels
   */
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
          key: `griditem-${getPanelIdForVizPanel(panel)}`,
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

  public static Component = ({ model }: SceneComponentProps<DefaultGridLayoutManager>) => {
    return <model.state.grid.Component model={model.state.grid} />;
  };
}
