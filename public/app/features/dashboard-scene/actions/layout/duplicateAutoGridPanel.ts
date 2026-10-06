import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';

import { type AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { getNextPanelId } from '../../utils/getNextPanelId';
import { getGridItemKeyForPanelId, getVizPanelKeyForPanelId } from '../../utils/utils-panels';
import { edit } from '../utils/edit';

export function duplicateAutoGridPanel(layout: AutoGridLayoutManager, panel: VizPanel) {
  const grid = layout.state.layout;
  const gridItem = grid.state.children.find((child) => child === panel.parent);
  if (!gridItem) {
    console.error('Trying to duplicate a panel that is not inside a DashboardGridItem');
    return;
  }

  const newPanelId = getNextPanelId(layout);

  const newPanel = panel.clone({
    key: getVizPanelKeyForPanelId(newPanelId),
  });

  let newGridItem = gridItem.clone({
    key: getGridItemKeyForPanelId(newPanelId),
    body: newPanel,
  });

  edit({
    meta: { actionId: 'panel.duplicate', scope: 'auto-grid' },
    description: t('dashboard.edit-actions.duplicate-panel', 'Duplicate panel'),
    source: layout,
    addedObject: newPanel,
    perform: () => {
      const sourceIndex = grid.state.children.findIndex((child) => child.state.body.state.key === panel.state.key);
      const newChildren = [...grid.state.children];
      newChildren.splice(sourceIndex + 1, 0, newGridItem);
      grid.setState({ children: newChildren });
    },
    undo: () => {
      newGridItem =
        grid.state.children.find((child) => child.state.body.state.key === newPanel.state.key) ?? newGridItem;
      grid.setState({
        children: grid.state.children.filter((child) => child.state.body.state.key !== newPanel.state.key),
      });
    },
  });
}
