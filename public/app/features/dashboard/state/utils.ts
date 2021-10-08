import { PanelModel } from './PanelModel';
import { REPEAT_DIR_HORIZONTAL } from '../../../core/constants';

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
