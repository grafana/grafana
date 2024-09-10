import {
  SceneObjectState,
  SceneGridLayout,
  SceneObjectBase,
  SceneGridRow,
  VizPanel,
  SceneObject,
  sceneGraph,
  sceneUtils,
  SceneComponentProps,
  SceneGridItemLike,
} from '@grafana/scenes';
import { GRID_COLUMN_COUNT } from 'app/core/constants';

import {
  forceRenderChildren,
  getDashboardSceneFor,
  getDefaultRow,
  getDefaultVizPanel,
  getPanelIdForVizPanel,
  NEW_PANEL_HEIGHT,
  NEW_PANEL_WIDTH,
  getVizPanelKeyForPanelId,
} from '../../utils/utils';
import { DashboardGridItem } from '../DashboardGridItem';
import { DashboardLayoutManager, DashboardLayoutElement } from '../types';

interface DefaultGridLayoutManagerState extends SceneObjectState {
  layout: SceneGridLayout;
}

/**
 * State manager for the default grid layout
 */
export class DefaultGridLayoutManager
  extends SceneObjectBase<DefaultGridLayoutManagerState>
  implements DashboardLayoutManager
{
  public editModeChanged(isEditing: boolean): void {
    this.state.layout.setState({ isDraggable: isEditing, isResizable: isEditing });
    forceRenderChildren(this.state.layout, true);
  }

  /**
   * Removes the first panel
   */
  public cleanUpStateFromExplore(): void {
    this.state.layout.setState({
      children: this.state.layout.state.children.slice(1),
    });
  }

  /**
   * Adds a new emtpy row
   */
  public addNewRow() {
    const dashboard = getDashboardSceneFor(this);
    const row = getDefaultRow(dashboard);

    const sceneGridLayout = this.state.layout;

    // find all panels until the first row and put them into the newly created row. If there are no other rows,
    // add all panels to the row. If there are no panels just create an empty row
    const indexTillNextRow = sceneGridLayout.state.children.findIndex((child) => child instanceof SceneGridRow);
    const rowChildren = sceneGridLayout.state.children
      .splice(0, indexTillNextRow === -1 ? sceneGridLayout.state.children.length : indexTillNextRow)
      .map((child) => child.clone());

    if (rowChildren) {
      row.setState({
        children: rowChildren,
      });
    }

    sceneGridLayout.setState({ children: [row, ...sceneGridLayout.state.children] });
  }

  /**
   * Removes a row
   * @param row
   * @param removePanels
   */
  public removeRow(row: SceneGridRow, removePanels = false) {
    const sceneGridLayout = this.state.layout;

    const children = sceneGridLayout.state.children.filter((child) => child.state.key !== row.state.key);

    if (!removePanels) {
      const rowChildren = row.state.children.map((child) => child.clone());
      const indexOfRow = sceneGridLayout.state.children.findIndex((child) => child.state.key === row.state.key);

      children.splice(indexOfRow, 0, ...rowChildren);
    }

    sceneGridLayout.setState({ children });
  }

  public addNewPanel(): VizPanel {
    const vizPanel = getDefaultVizPanel(getDashboardSceneFor(this));
    const sceneGridLayout = this.state.layout;

    const panelId = getPanelIdForVizPanel(vizPanel);
    const newGridItem = new DashboardGridItem({
      height: NEW_PANEL_HEIGHT,
      width: NEW_PANEL_WIDTH,
      x: 0,
      y: 0,
      body: vizPanel,
      key: `grid-item-${panelId}`,
    });

    sceneGridLayout.setState({
      children: [newGridItem, ...sceneGridLayout.state.children],
    });

    return vizPanel;
  }

  /**
   * Element here can be a DashboardGridItem
   * @param element
   * @returns
   */
  public removeElement(element: DashboardLayoutElement) {
    const layout = this.state.layout;

    let row: SceneGridRow | undefined;

    try {
      row = sceneGraph.getAncestor(element, SceneGridRow);
    } catch {
      row = undefined;
    }

    if (row) {
      row.setState({ children: row.state.children.filter((child) => child !== element) });
      layout.forceRender();
      return;
    }

    this.state.layout.setState({
      children: layout.state.children.filter((child) => child !== element),
    });
  }

  public duplicateElement(element: DashboardLayoutElement): void {
    // if (!vizPanel.parent) {
    //   return;
    // }

    // const libraryPanel = getLibraryVizPanelFromVizPanel(vizPanel);

    // const gridItem = libraryPanel ? libraryPanel.parent : vizPanel.parent;

    if (!(element instanceof DashboardGridItem)) {
      console.error('Trying to duplicate a panel in a layout that is not DashboardGridItem');
      return;
    }

    let panelState;
    let panelData;
    const newPanelId = this.getNextPanelId();

    // if (libraryPanel) {
    //   const gridItemToDuplicateState = sceneUtils.cloneSceneObjectState(gridItem.state);

    //   newGridItem = new DashboardGridItem({
    //     x: gridItemToDuplicateState.x,
    //     y: gridItemToDuplicateState.y,
    //     width: gridItemToDuplicateState.width,
    //     height: gridItemToDuplicateState.height,
    //     body: new LibraryVizPanel({
    //       title: libraryPanel.state.title,
    //       uid: libraryPanel.state.uid,
    //       name: libraryPanel.state.name,
    //       panelKey: getVizPanelKeyForPanelId(newPanelId),
    //     }),
    //   });
    // } else {

    panelState = sceneUtils.cloneSceneObjectState(element.state.body.state);
    panelData = sceneGraph.getData(element.state.body).clone();

    // when we duplicate a panel we don't want to clone the alert state
    delete panelData.state.data?.alertState;

    const newGridItem = new DashboardGridItem({
      x: element.state.x,
      y: element.state.y,
      height: element.state.height,
      width: element.state.width,
      body: new VizPanel({ ...panelState, $data: panelData, key: getVizPanelKeyForPanelId(newPanelId) }),
    });

    const layout = this.state.layout;

    if (element.parent instanceof SceneGridRow) {
      const row = element.parent;

      row.setState({ children: [...row.state.children, newGridItem] });

      layout.forceRender();
      return;
    }

    layout.setState({
      children: [...layout.state.children, newGridItem],
    });
  }

  public getVizPanels(): VizPanel[] {
    const panels: VizPanel[] = [];

    this.state.layout.forEachChild((child) => {
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

    for (const child of this.state.layout.state.children) {
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
      layout: new SceneGridLayout({
        children: children,
        isDraggable: false,
        isResizable: false,
      }),
    });
  }

  public static Component = ({ model }: SceneComponentProps<DefaultGridLayoutManager>) => {
    return <model.state.layout.Component model={model.state.layout} />;
  };
}
