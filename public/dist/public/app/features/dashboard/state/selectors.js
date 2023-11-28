import { getPanelPluginNotFound } from '../../panel/components/PanelPluginError';
export const getPanelPluginWithFallback = (panelType) => (state) => {
    const plugin = state.plugins.panels[panelType];
    return plugin || getPanelPluginNotFound(`Panel plugin not found (${panelType})`, true);
};
//# sourceMappingURL=selectors.js.map