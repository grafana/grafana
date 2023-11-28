import { REPEAT_DIR_HORIZONTAL } from '../../../core/constants';
export function isOnTheSameGridRow(sourcePanel, otherPanel) {
    if (sourcePanel.repeatDirection === REPEAT_DIR_HORIZONTAL) {
        return false;
    }
    if (otherPanel.gridPos.x >= sourcePanel.gridPos.x + sourcePanel.gridPos.w &&
        otherPanel.gridPos.y === sourcePanel.gridPos.y) {
        return true;
    }
    return false;
}
export function deleteScopeVars(panels) {
    var _a;
    for (const panel of panels) {
        delete panel.scopedVars;
        if ((_a = panel.panels) === null || _a === void 0 ? void 0 : _a.length) {
            for (const collapsedPanel of panel.panels) {
                delete collapsedPanel.scopedVars;
            }
        }
    }
}
//# sourceMappingURL=utils.js.map