import { isArray, omit, pick, isNil, omitBy } from 'lodash';
export function grafanaReceiverToFormValues(receiver, notifiers) {
    var _a, _b;
    const channelMap = {};
    // giving each form receiver item a unique id so we can use it to map back to "original" items
    // as well as to use as `key` prop.
    // @TODO use uid once backend is fixed to provide it. then we can get rid of the GrafanaChannelMap
    let idCounter = 1;
    const values = {
        name: receiver.name,
        items: (_b = (_a = receiver.grafana_managed_receiver_configs) === null || _a === void 0 ? void 0 : _a.map((channel) => {
            const id = String(idCounter++);
            channelMap[id] = channel;
            const notifier = notifiers.find(({ type }) => type === channel.type);
            return grafanaChannelConfigToFormChannelValues(id, channel, notifier);
        })) !== null && _b !== void 0 ? _b : [],
    };
    return [values, channelMap];
}
export function cloudReceiverToFormValues(receiver, notifiers) {
    const channelMap = {};
    // giving each form receiver item a unique id so we can use it to map back to "original" items
    let idCounter = 1;
    const items = Object.entries(receiver)
        // filter out only config items that are relevant to cloud
        .filter(([type]) => type.endsWith('_configs') && type !== 'grafana_managed_receiver_configs')
        // map property names to cloud notifier types by removing the `_config` suffix
        .map(([type, configs]) => [
        type.replace('_configs', ''),
        configs,
    ])
        // convert channel configs to form values
        .map(([type, configs]) => configs.map((config) => {
        const id = String(idCounter++);
        channelMap[id] = { type, config };
        const notifier = notifiers.find((notifier) => notifier.type === type);
        if (!notifier) {
            throw new Error(`unknown cloud notifier: ${type}`);
        }
        return cloudChannelConfigToFormChannelValues(id, type, config);
    }))
        .flat();
    const values = {
        name: receiver.name,
        items,
    };
    return [values, channelMap];
}
export function formValuesToGrafanaReceiver(values, channelMap, defaultChannelValues, notifiers) {
    var _a;
    return {
        name: values.name,
        grafana_managed_receiver_configs: ((_a = values.items) !== null && _a !== void 0 ? _a : []).map((channelValues) => {
            const existing = channelMap[channelValues.__id];
            const notifier = notifiers.find((notifier) => notifier.type === channelValues.type);
            return formChannelValuesToGrafanaChannelConfig(channelValues, defaultChannelValues, values.name, existing, notifier);
        }),
    };
}
export function formValuesToCloudReceiver(values, defaults) {
    const recv = {
        name: values.name,
    };
    values.items.forEach(({ __id, type, settings, sendResolved }) => {
        var _a;
        const channel = omitEmptyValues(Object.assign(Object.assign({}, settings), { send_resolved: sendResolved !== null && sendResolved !== void 0 ? sendResolved : defaults.sendResolved }));
        if (!(`${type}_configs` in recv)) {
            recv[`${type}_configs`] = [channel];
        }
        else {
            (_a = recv[`${type}_configs`]) === null || _a === void 0 ? void 0 : _a.push(channel);
        }
    });
    return recv;
}
// will add new receiver, or replace exisitng one
export function updateConfigWithReceiver(config, receiver, replaceReceiverName) {
    var _a;
    const oldReceivers = (_a = config.alertmanager_config.receivers) !== null && _a !== void 0 ? _a : [];
    // sanity check that name is not duplicated
    if (receiver.name !== replaceReceiverName && !!oldReceivers.find(({ name }) => name === receiver.name)) {
        throw new Error(`Duplicate receiver name ${receiver.name}`);
    }
    // sanity check that existing receiver exists
    if (replaceReceiverName && !oldReceivers.find(({ name }) => name === replaceReceiverName)) {
        throw new Error(`Expected receiver ${replaceReceiverName} to exist, but did not find it in the config`);
    }
    const updated = Object.assign(Object.assign({}, config), { alertmanager_config: Object.assign(Object.assign({}, config.alertmanager_config), { receivers: replaceReceiverName
                ? oldReceivers.map((existingReceiver) => existingReceiver.name === replaceReceiverName ? receiver : existingReceiver)
                : [...oldReceivers, receiver] }) });
    // if receiver was renamed, rename it in routes as well
    if (updated.alertmanager_config.route && replaceReceiverName && receiver.name !== replaceReceiverName) {
        updated.alertmanager_config.route = renameReceiverInRoute(updated.alertmanager_config.route, replaceReceiverName, receiver.name);
    }
    return updated;
}
function renameReceiverInRoute(route, oldName, newName) {
    const updated = Object.assign({}, route);
    if (updated.receiver === oldName) {
        updated.receiver = newName;
    }
    if (updated.routes) {
        updated.routes = updated.routes.map((route) => renameReceiverInRoute(route, oldName, newName));
    }
    return updated;
}
function cloudChannelConfigToFormChannelValues(id, type, channel) {
    return {
        __id: id,
        type,
        settings: Object.assign({}, channel),
        secureFields: {},
        secureSettings: {},
        sendResolved: channel.send_resolved,
    };
}
function grafanaChannelConfigToFormChannelValues(id, channel, notifier) {
    const values = {
        __id: id,
        type: channel.type,
        provenance: channel.provenance,
        secureSettings: {},
        settings: Object.assign({}, channel.settings),
        secureFields: Object.assign({}, channel.secureFields),
        disableResolveMessage: channel.disableResolveMessage,
    };
    // work around https://github.com/grafana/alerting-squad/issues/100
    notifier === null || notifier === void 0 ? void 0 : notifier.options.forEach((option) => {
        if (option.secure && values.secureSettings[option.propertyName]) {
            delete values.settings[option.propertyName];
            values.secureFields[option.propertyName] = true;
        }
        if (option.secure && values.settings[option.propertyName]) {
            values.secureSettings[option.propertyName] = values.settings[option.propertyName];
            delete values.settings[option.propertyName];
        }
    });
    return values;
}
export function formChannelValuesToGrafanaChannelConfig(values, defaults, name, existing, notifier) {
    var _a, _b, _c, _d, _e;
    const channel = {
        settings: omitEmptyValues(Object.assign(Object.assign({}, (existing && existing.type === values.type ? (_a = existing.settings) !== null && _a !== void 0 ? _a : {} : {})), ((_b = values.settings) !== null && _b !== void 0 ? _b : {}))),
        secureSettings: omitEmptyUnlessExisting(values.secureSettings, existing === null || existing === void 0 ? void 0 : existing.secureFields),
        type: values.type,
        name,
        disableResolveMessage: (_d = (_c = values.disableResolveMessage) !== null && _c !== void 0 ? _c : existing === null || existing === void 0 ? void 0 : existing.disableResolveMessage) !== null && _d !== void 0 ? _d : defaults.disableResolveMessage,
    };
    // find all secure field definitions
    const secureFieldNames = (_e = notifier === null || notifier === void 0 ? void 0 : notifier.options.filter((option) => option.secure).map((option) => option.propertyName)) !== null && _e !== void 0 ? _e : [];
    // we make sure all fields that are marked as "secure" will be moved to "SecureSettings" instead of "settings"
    const shouldBeSecure = pick(channel.settings, secureFieldNames);
    channel.secureSettings = Object.assign(Object.assign({}, shouldBeSecure), channel.secureSettings);
    // remove the secure ones from the regular settings
    channel.settings = omit(channel.settings, secureFieldNames);
    if (existing) {
        channel.uid = existing.uid;
    }
    return channel;
}
// null, undefined and '' are deemed unacceptable
const isUnacceptableValue = (value) => isNil(value) || value === '';
// will remove properties that have empty ('', null, undefined) object properties.
// traverses nested objects and arrays as well. in place, mutates the object.
// this is needed because form will submit empty string for not filled in fields,
// but for cloud alertmanager receiver config to use global default value the property must be omitted entirely
// this isn't a perfect solution though. No way for user to intentionally provide an empty string. Will need rethinking later
export function omitEmptyValues(obj) {
    if (isArray(obj)) {
        obj.forEach(omitEmptyValues);
    }
    else if (typeof obj === 'object' && obj !== null) {
        Object.entries(obj).forEach(([key, value]) => {
            if (isUnacceptableValue(value)) {
                delete obj[key];
            }
            else {
                omitEmptyValues(value);
            }
        });
    }
    return obj;
}
// Will remove empty ('', null, undefined) object properties unless they were previously defined.
// existing is a map of property names that were previously defined.
export function omitEmptyUnlessExisting(settings = {}, existing = {}) {
    return omitBy(settings, (value, key) => isUnacceptableValue(value) && !(key in existing));
}
//# sourceMappingURL=receiver-form.js.map