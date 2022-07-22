import { REPEAT_DIR_HORIZONTAL } from '../../../core/constants';

import { PanelModel } from './PanelModel';

export function isOnTheSameGridRow(sourcePanel: PanelModel, otherPanel: PanelModel): boolean {
  if (sourcePanel.repeatDirection === REPEAT_DIR_HORIZONTAL) {
    return false;
  }

  if (
    otherPanel.gridPos.x >= sourcePanel.gridPos.x + sourcePanel.gridPos.w &&
    otherPanel.gridPos.y === sourcePanel.gridPos.y
  ) {
    return true;
  }

  return false;
}

export function deleteScopeVars(panels: PanelModel[]) {
  for (const panel of panels) {
    delete panel.scopedVars;
    if (panel.panels?.length) {
      for (const collapsedPanel of panel.panels) {
        delete collapsedPanel.scopedVars;
      }
    }
  }
}
