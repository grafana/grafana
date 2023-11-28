import { capitalize, isEmpty, times } from 'lodash';
import { receiverTypeNames } from 'app/plugins/datasource/alertmanager/consts';
export function extractNotifierTypeCounts(receiver, grafanaNotifiers) {
    var _a;
    if ('grafana_managed_receiver_configs' in receiver) {
        return getGrafanaNotifierTypeCounts((_a = receiver.grafana_managed_receiver_configs) !== null && _a !== void 0 ? _a : [], grafanaNotifiers);
    }
    return getCortexAlertManagerNotifierTypeCounts(receiver);
}
function getCortexAlertManagerNotifierTypeCounts(receiver) {
    return Object.entries(receiver)
        .filter(([key]) => key !== 'grafana_managed_receiver_configs' && key.endsWith('_configs')) // filter out only properties that are alertmanager notifier
        .filter(([_, value]) => Array.isArray(value) && !!value.length) // check that there are actually notifiers of this type configured
        .reduce((acc, [key, value]) => {
        var _a, _b;
        const type = key.replace('_configs', ''); // remove the `_config` part from the key, making it intto a notifier name
        const name = (_a = receiverTypeNames[type]) !== null && _a !== void 0 ? _a : capitalize(type);
        return Object.assign(Object.assign({}, acc), { [name]: ((_b = acc[name]) !== null && _b !== void 0 ? _b : 0) + (Array.isArray(value) ? value.length : 1) });
    }, {});
}
/**
 * This function will extract the integrations that have been defined for either grafana managed contact point
 * or vanilla Alertmanager receiver.
 *
 * It will attempt to normalize the data structure to how they have been defined for Grafana managed contact points.
 * That way we can work with the same data structure in the UI.
 *
 * We don't normalize the configuration settings and those are blank for vanilla Alertmanager receivers.
 *
 * Example input:
 *  { name: 'my receiver', email_configs: [{ from: "foo@bar.com" }] }
 *
 * Example output:
 *  { name: 'my receiver', grafana_managed_receiver_configs: [{ type: 'email', settings: {} }] }
 */
export function extractReceivers(receiver) {
    var _a;
    if ('grafana_managed_receiver_configs' in receiver) {
        return (_a = receiver.grafana_managed_receiver_configs) !== null && _a !== void 0 ? _a : [];
    }
    const integrations = Object.entries(receiver)
        .filter(([key]) => key !== 'grafana_managed_receiver_configs' && key.endsWith('_configs'))
        .filter(([_, value]) => Array.isArray(value) && !isEmpty(value))
        .reduce((acc, [key, value]) => {
        const type = key.replace('_configs', '');
        const configs = times(value.length, () => ({
            name: receiver.name,
            type: type,
            settings: [],
            disableResolveMessage: false,
        }));
        return acc.concat(configs);
    }, []);
    return integrations;
}
function getGrafanaNotifierTypeCounts(configs, grafanaNotifiers) {
    return configs
        .map((recv) => recv.type) // extract types from config
        .map((type) => { var _a, _b; return (_b = (_a = grafanaNotifiers.find((r) => r.type === type)) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : capitalize(type); }) // get readable name from notifier cofnig, or if not available, just capitalize
        .reduce((acc, type) => {
        var _a;
        return (Object.assign(Object.assign({}, acc), { [type]: ((_a = acc[type]) !== null && _a !== void 0 ? _a : 0) + 1 }));
    }, {});
}
//# sourceMappingURL=receivers.js.map