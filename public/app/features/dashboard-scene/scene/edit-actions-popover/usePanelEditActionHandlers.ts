import { useCallback } from 'react';

import { locationService } from '@grafana/runtime';
import { type VizPanel } from '@grafana/scenes';

import { duplicatePanel } from '../../actions/layout/duplicatePanel';
import { getLayoutManagerFor } from '../../utils/getLayoutManagerFor';
import { DashboardInteractions } from '../../utils/interactions';
import { getPanelIdForVizPanel } from '../../utils/utils-panels';
import { getDashboardSceneLike } from '../types/dashboard';

export function usePanelEditActionHandlers(panel: VizPanel, source: 'edit_popover' | 'hover_popover') {
  const onClickEdit = useCallback(() => {
    DashboardInteractions.panelActionClicked('settings', getPanelIdForVizPanel(panel), source);
    const { selectionContext } = getDashboardSceneLike(panel).state.sidebar.state;
    selectionContext.onSelect({ id: panel.state.key! }, { force: true });
  }, [panel, source]);

  const onClickEditVisualization = useCallback(() => {
    const panelId = getPanelIdForVizPanel(panel);
    DashboardInteractions.panelActionClicked('configure', panelId, source);
    locationService.partial({ editPanel: panelId });
  }, [panel, source]);

  const onClickCopy = useCallback(() => {
    const panelId = getPanelIdForVizPanel(panel);
    DashboardInteractions.panelActionClicked('copy', panelId, source);
    getDashboardSceneLike(panel).copyPanel(panel);
  }, [panel, source]);

  const onClickDuplicate = useCallback(() => {
    const panelId = getPanelIdForVizPanel(panel);
    DashboardInteractions.panelActionClicked('duplicate', panelId, source);
    duplicatePanel(panel);
  }, [panel, source]);

  const onClickDelete = useCallback(() => {
    const panelId = getPanelIdForVizPanel(panel);
    DashboardInteractions.panelActionClicked('delete', panelId, source);
    getLayoutManagerFor(panel).removePanel?.(panel);
  }, [panel, source]);

  return { onClickEdit, onClickEditVisualization, onClickCopy, onClickDuplicate, onClickDelete };
}
