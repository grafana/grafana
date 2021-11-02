import { __assign, __read } from "tslib";
import { receiverTypeNames } from 'app/plugins/datasource/alertmanager/consts';
import { capitalize } from 'lodash';
export function extractNotifierTypeCounts(receiver, grafanaNotifiers) {
    var _a;
    if (receiver['grafana_managed_receiver_configs']) {
        return getGrafanaNotifierTypeCounts((_a = receiver.grafana_managed_receiver_configs) !== null && _a !== void 0 ? _a : [], grafanaNotifiers);
    }
    return getCortexAlertManagerNotifierTypeCounts(receiver);
}
function getCortexAlertManagerNotifierTypeCounts(receiver) {
    return Object.entries(receiver)
        .filter(function (_a) {
        var _b = __read(_a, 1), key = _b[0];
        return key !== 'grafana_managed_receiver_configs' && key.endsWith('_configs');
    }) // filter out only properties that are alertmanager notifier
        .filter(function (_a) {
        var _b = __read(_a, 2), _ = _b[0], value = _b[1];
        return Array.isArray(value) && !!value.length;
    }) // check that there are actually notifiers of this type configured
        .reduce(function (acc, _a) {
        var _b;
        var _c, _d;
        var _e = __read(_a, 2), key = _e[0], value = _e[1];
        var type = key.replace('_configs', ''); // remove the `_config` part from the key, making it intto a notifier name
        var name = (_c = receiverTypeNames[type]) !== null && _c !== void 0 ? _c : capitalize(type);
        return __assign(__assign({}, acc), (_b = {}, _b[name] = ((_d = acc[name]) !== null && _d !== void 0 ? _d : 0) + (Array.isArray(value) ? value.length : 1), _b));
    }, {});
}
function getGrafanaNotifierTypeCounts(configs, grafanaNotifiers) {
    return configs
        .map(function (recv) { return recv.type; }) // extract types from config
        .map(function (type) { var _a, _b; return (_b = (_a = grafanaNotifiers.find(function (r) { return r.type === type; })) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : capitalize(type); }) // get readable name from notifier cofnig, or if not available, just capitalize
        .reduce(function (acc, type) {
        var _a;
        var _b;
        return (__assign(__assign({}, acc), (_a = {}, _a[type] = ((_b = acc[type]) !== null && _b !== void 0 ? _b : 0) + 1, _a)));
    }, {});
}
//# sourceMappingURL=receivers.js.map