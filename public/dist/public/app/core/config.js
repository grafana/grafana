var _a, _b;
import { __assign } from "tslib";
import { config, GrafanaBootConfig } from '@grafana/runtime';
import { PluginState } from '@grafana/data';
// Legacy binding paths
export { config, GrafanaBootConfig as Settings };
var grafanaConfig = config;
export default grafanaConfig;
export var getConfig = function () {
    return grafanaConfig;
};
export var updateConfig = function (update) {
    grafanaConfig = __assign(__assign({}, grafanaConfig), update);
};
// The `enable_alpha` flag is no exposed directly, this is equivolant
export var hasAlphaPanels = Boolean(((_b = (_a = config.panels) === null || _a === void 0 ? void 0 : _a.debug) === null || _b === void 0 ? void 0 : _b.state) === PluginState.alpha);
//# sourceMappingURL=config.js.map