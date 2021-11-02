import { getPanelPluginNotFound } from '../../panel/components/PanelPluginError';
export var getPanelPluginWithFallback = function (panelType) { return function (state) {
    var plugin = state.plugins.panels[panelType];
    return plugin || getPanelPluginNotFound("Panel plugin not found (" + panelType + ")", true);
}; };
//# sourceMappingURL=selectors.js.map