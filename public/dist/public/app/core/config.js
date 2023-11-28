var _a, _b;
import { PluginState } from '@grafana/data';
import { config, GrafanaBootConfig } from '@grafana/runtime';
// Legacy binding paths
export { config, GrafanaBootConfig as Settings };
let grafanaConfig = config;
export default grafanaConfig;
export const getConfig = () => {
    return grafanaConfig;
};
export const updateConfig = (update) => {
    grafanaConfig = Object.assign(Object.assign({}, grafanaConfig), update);
};
// The `enable_alpha` flag is not exposed directly, this is equivalent
export const hasAlphaPanels = Boolean(((_b = (_a = config.panels) === null || _a === void 0 ? void 0 : _a.debug) === null || _b === void 0 ? void 0 : _b.state) === PluginState.alpha);
//# sourceMappingURL=config.js.map