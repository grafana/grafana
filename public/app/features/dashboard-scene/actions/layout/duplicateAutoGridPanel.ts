import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';

import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { type AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getGridItemKeyForPanelId, getVizPanelKeyForPanelId } from '../../utils/utils-panels';
import { edit } from '../utils/edit';

export function duplicateAutoGridPanel(layout: AutoGridLayoutManager, panel: VizPanel) {
  const gridItem = panel.parent;
  if (!(gridItem instanceof AutoGridItem)) {
    console.error('Trying to duplicate a panel that is not inside a DashboardGridItem');
    return;
  }

  const newPanelId = dashboardSceneGraph.getNextPanelId(layout);
  const grid = layout.state.layout;

  const newPanel = panel.clone({
    key: getVizPanelKeyForPanelId(newPanelId),
  });

  let newGridItem = gridItem.clone({
    key: getGridItemKeyForPanelId(newPanelId),
    body: newPanel,
  });

  edit({
    description: t('dashboard.edit-actions.duplicate-panel', 'Duplicate panel'),
    source: layout,
    addedObject: newPanel,
    perform: () => {
      newGridItem = newPanel.parent instanceof AutoGridItem ? newPanel.parent : newGridItem;
      const sourceIndex = grid.state.children.findIndex((child) => child.state.body.state.key === panel.state.key);
      const newChildren = [...grid.state.children];
      newChildren.splice(sourceIndex + 1, 0, newGridItem);
      grid.setState({ children: newChildren });
    },
    undo: () => {
      grid.setState({
        children: grid.state.children.filter((child) => child.state.body.state.key !== newPanel.state.key),
      });
    },
  });
}
