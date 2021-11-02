import { __assign, __read, __spreadArray } from "tslib";
import { isArray } from 'angular';
export function grafanaReceiverToFormValues(receiver, notifiers) {
    var _a, _b;
    var channelMap = {};
    // giving each form receiver item a unique id so we can use it to map back to "original" items
    // as well as to use as `key` prop.
    // @TODO use uid once backend is fixed to provide it. then we can get rid of the GrafanaChannelMap
    var idCounter = 1;
    var values = {
        name: receiver.name,
        items: (_b = (_a = receiver.grafana_managed_receiver_configs) === null || _a === void 0 ? void 0 : _a.map(function (channel) {
            var id = String(idCounter++);
            channelMap[id] = channel;
            var notifier = notifiers.find(function (_a) {
                var type = _a.type;
                return type === channel.type;
            });
            return grafanaChannelConfigToFormChannelValues(id, channel, notifier);
        })) !== null && _b !== void 0 ? _b : [],
    };
    return [values, channelMap];
}
export function cloudReceiverToFormValues(receiver, notifiers) {
    var channelMap = {};
    // giving each form receiver item a unique id so we can use it to map back to "original" items
    var idCounter = 1;
    var items = Object.entries(receiver)
        // filter out only config items that are relevant to cloud
        .filter(function (_a) {
        var _b = __read(_a, 1), type = _b[0];
        return type.endsWith('_configs') && type !== 'grafana_managed_receiver_configs';
    })
        // map property names to cloud notifier types by removing the `_config` suffix
        .map(function (_a) {
        var _b = __read(_a, 2), type = _b[0], configs = _b[1];
        return [
            type.replace('_configs', ''),
            configs,
        ];
    })
        // convert channel configs to form values
        .map(function (_a) {
        var _b = __read(_a, 2), type = _b[0], configs = _b[1];
        return configs.map(function (config) {
            var id = String(idCounter++);
            channelMap[id] = { type: type, config: config };
            var notifier = notifiers.find(function (notifier) { return notifier.type === type; });
            if (!notifier) {
                throw new Error("unknown cloud notifier: " + type);
            }
            return cloudChannelConfigToFormChannelValues(id, type, config);
        });
    })
        .flat();
    var values = {
        name: receiver.name,
        items: items,
    };
    return [values, channelMap];
}
export function formValuesToGrafanaReceiver(values, channelMap, defaultChannelValues) {
    var _a;
    return {
        name: values.name,
        grafana_managed_receiver_configs: ((_a = values.items) !== null && _a !== void 0 ? _a : []).map(function (channelValues) {
            var existing = channelMap[channelValues.__id];
            return formChannelValuesToGrafanaChannelConfig(channelValues, defaultChannelValues, values.name, existing);
        }),
    };
}
export function formValuesToCloudReceiver(values, defaults) {
    var recv = {
        name: values.name,
    };
    values.items.forEach(function (_a) {
        var __id = _a.__id, type = _a.type, settings = _a.settings, sendResolved = _a.sendResolved;
        var channel = omitEmptyValues(__assign(__assign({}, settings), { send_resolved: sendResolved !== null && sendResolved !== void 0 ? sendResolved : defaults.sendResolved }));
        var configsKey = type + "_configs";
        if (!recv[configsKey]) {
            recv[configsKey] = [channel];
        }
        else {
            recv[configsKey].push(channel);
        }
    });
    return recv;
}
// will add new receiver, or replace exisitng one
export function updateConfigWithReceiver(config, receiver, replaceReceiverName) {
    var _a;
    var oldReceivers = (_a = config.alertmanager_config.receivers) !== null && _a !== void 0 ? _a : [];
    // sanity check that name is not duplicated
    if (receiver.name !== replaceReceiverName && !!oldReceivers.find(function (_a) {
        var name = _a.name;
        return name === receiver.name;
    })) {
        throw new Error("Duplicate receiver name " + receiver.name);
    }
    // sanity check that existing receiver exists
    if (replaceReceiverName && !oldReceivers.find(function (_a) {
        var name = _a.name;
        return name === replaceReceiverName;
    })) {
        throw new Error("Expected receiver " + replaceReceiverName + " to exist, but did not find it in the config");
    }
    var updated = __assign(__assign({}, config), { alertmanager_config: __assign(__assign({}, config.alertmanager_config), { receivers: replaceReceiverName
                ? oldReceivers.map(function (existingReceiver) {
                    return existingReceiver.name === replaceReceiverName ? receiver : existingReceiver;
                })
                : __spreadArray(__spreadArray([], __read(oldReceivers), false), [receiver], false) }) });
    // if receiver was renamed, rename it in routes as well
    if (updated.alertmanager_config.route && replaceReceiverName && receiver.name !== replaceReceiverName) {
        updated.alertmanager_config.route = renameReceiverInRoute(updated.alertmanager_config.route, replaceReceiverName, receiver.name);
    }
    return updated;
}
function renameReceiverInRoute(route, oldName, newName) {
    var updated = __assign({}, route);
    if (updated.receiver === oldName) {
        updated.receiver = newName;
    }
    if (updated.routes) {
        updated.routes = updated.routes.map(function (route) { return renameReceiverInRoute(route, oldName, newName); });
    }
    return updated;
}
function cloudChannelConfigToFormChannelValues(id, type, channel) {
    return {
        __id: id,
        type: type,
        settings: __assign({}, channel),
        secureFields: {},
        secureSettings: {},
        sendResolved: channel.send_resolved,
    };
}
function grafanaChannelConfigToFormChannelValues(id, channel, notifier) {
    var values = {
        __id: id,
        type: channel.type,
        secureSettings: {},
        settings: __assign({}, channel.settings),
        secureFields: __assign({}, channel.secureFields),
        disableResolveMessage: channel.disableResolveMessage,
    };
    // work around https://github.com/grafana/alerting-squad/issues/100
    notifier === null || notifier === void 0 ? void 0 : notifier.options.forEach(function (option) {
        if (option.secure && values.settings[option.propertyName]) {
            delete values.settings[option.propertyName];
            values.secureFields[option.propertyName] = true;
        }
    });
    return values;
}
export function formChannelValuesToGrafanaChannelConfig(values, defaults, name, existing) {
    var _a, _b, _c, _d, _e;
    var channel = {
        settings: omitEmptyValues(__assign(__assign({}, (existing && existing.type === values.type ? (_a = existing.settings) !== null && _a !== void 0 ? _a : {} : {})), ((_b = values.settings) !== null && _b !== void 0 ? _b : {}))),
        secureSettings: (_c = values.secureSettings) !== null && _c !== void 0 ? _c : {},
        type: values.type,
        name: name,
        disableResolveMessage: (_e = (_d = values.disableResolveMessage) !== null && _d !== void 0 ? _d : existing === null || existing === void 0 ? void 0 : existing.disableResolveMessage) !== null && _e !== void 0 ? _e : defaults.disableResolveMessage,
    };
    if (existing) {
        channel.uid = existing.uid;
    }
    return channel;
}
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
        Object.entries(obj).forEach(function (_a) {
            var _b = __read(_a, 2), key = _b[0], value = _b[1];
            if (value === '' || value === null || value === undefined) {
                delete obj[key];
            }
            else {
                omitEmptyValues(value);
            }
        });
    }
    return obj;
}
//# sourceMappingURL=receiver-form.js.map