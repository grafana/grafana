import { PanelModel } from './PanelModel';

export function isOnTheSameGridRow(sourcePanel: PanelModel, otherPanel: PanelModel): boolean {
  if (
    otherPanel.gridPos.x >= sourcePanel.gridPos.x + sourcePanel.gridPos.w &&
    otherPanel.gridPos.y === sourcePanel.gridPos.y
  ) {
    return true;
  }

  return false;
}
