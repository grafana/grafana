import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { SceneGridRow, VizPanel, sceneGraph, sceneUtils } from '@grafana/scenes';

import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { type DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { NewObjectAddedToCanvasEvent } from '../../sidebar/events';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getGridItemKeyForPanelId, getVizPanelKeyForPanelId } from '../../utils/utils-panels';
import { edit } from '../utils/edit';

export function duplicateDefaultGridPanel(layout: DefaultGridLayoutManager, vizPanel: VizPanel) {
  const gridItem = vizPanel.parent;
  if (!(gridItem instanceof DashboardGridItem)) {
    console.error('Trying to duplicate a panel that is not inside a DashboardGridItem');
    return;
  }

  let panelState;
  let panelData;
  let newGridItem;

  const newPanelId = dashboardSceneGraph.getNextPanelId(layout);
  const grid = layout.state.grid;

  if (gridItem instanceof DashboardGridItem) {
    panelState = sceneUtils.cloneSceneObjectState(gridItem.state.body.state);
    panelData = sceneGraph.getData(gridItem.state.body).clone();
  } else {
    panelState = sceneUtils.cloneSceneObjectState(vizPanel.state);
    panelData = sceneGraph.getData(vizPanel).clone();
  }

  // when we duplicate a panel we don't want to clone the alert state
  delete panelData.state.data?.alertState;

  const newPanel = new VizPanel({
    ...panelState,
    $data: panelData,
    key: getVizPanelKeyForPanelId(newPanelId),
  });

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
    body: newPanel,
  });

  // No undo/redo support in legacy edit mode
  if (!config.featureToggles.dashboardNewLayouts) {
    if (gridItem.parent instanceof SceneGridRow) {
      const row = gridItem.parent;

      row.setState({ children: [...row.state.children, newGridItem] });
      grid.forceRender();
      return;
    }

    grid.setState({ children: [...grid.state.children, newGridItem] });
    layout.publishEvent(new NewObjectAddedToCanvasEvent(newPanel), true);
    return;
  }

  const parent = gridItem.parent instanceof SceneGridRow ? gridItem.parent : grid;
  edit({
    description: t('dashboard.edit-actions.duplicate-panel', 'Duplicate panel'),
    addedObject: newGridItem.state.body,
    source: layout,
    perform: () => {
      const oldGridItemIndex = parent.state.children.indexOf(gridItem);
      const newChildrenArray = [...parent.state.children];
      newChildrenArray.splice(oldGridItemIndex + 1, 0, newGridItem);
      parent.setState({ children: newChildrenArray });
    },
    undo: () => {
      parent.setState({
        children: parent.state.children.filter((child) => child !== newGridItem),
      });
    },
  });
}
