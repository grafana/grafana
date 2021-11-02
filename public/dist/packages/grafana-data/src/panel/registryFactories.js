import { __assign, __values } from "tslib";
import { FieldConfigOptionsRegistry } from '../field/FieldConfigOptionsRegistry';
import { standardFieldConfigEditorRegistry } from '../field/standardFieldConfigEditorRegistry';
import { FieldConfigEditorBuilder } from '../utils/OptionsUIBuilders';
/**
 * Helper functionality to create a field config registry.
 *
 * @param config - configuration to base the registry on.
 * @param pluginName - name of the plugin that will use the registry.
 * @internal
 */
export function createFieldConfigRegistry(config, pluginName) {
    var e_1, _a, e_2, _b, e_3, _c, e_4, _d;
    var _e, _f, _g;
    if (config === void 0) { config = {}; }
    var registry = new FieldConfigOptionsRegistry();
    var standardConfigs = standardFieldConfigEditorRegistry.list();
    var standardOptionsExtensions = {};
    // Add custom options
    if (config.useCustomConfig) {
        var builder = new FieldConfigEditorBuilder();
        config.useCustomConfig(builder);
        try {
            for (var _h = __values(builder.getRegistry().list()), _j = _h.next(); !_j.done; _j = _h.next()) {
                var customProp = _j.value;
                customProp.isCustom = true;
                // need to do something to make the custom items not conflict with standard ones
                // problem is id (registry index) is used as property path
                // so sort of need a property path on the FieldPropertyEditorItem
                customProp.id = 'custom.' + customProp.id;
                if (isStandardConfigExtension(customProp, standardConfigs)) {
                    var currentExtensions = (_e = standardOptionsExtensions[customProp.category[0]]) !== null && _e !== void 0 ? _e : [];
                    currentExtensions.push(customProp);
                    standardOptionsExtensions[customProp.category[0]] = currentExtensions;
                }
                else {
                    registry.register(customProp);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_j && !_j.done && (_a = _h.return)) _a.call(_h);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    try {
        for (var standardConfigs_1 = __values(standardConfigs), standardConfigs_1_1 = standardConfigs_1.next(); !standardConfigs_1_1.done; standardConfigs_1_1 = standardConfigs_1.next()) {
            var fieldConfigProp = standardConfigs_1_1.value;
            if (config.disableStandardOptions) {
                var isDisabled = config.disableStandardOptions.indexOf(fieldConfigProp.id) > -1;
                if (isDisabled) {
                    continue;
                }
            }
            if (config.standardOptions) {
                var customDefault = (_f = config.standardOptions[fieldConfigProp.id]) === null || _f === void 0 ? void 0 : _f.defaultValue;
                var customSettings = (_g = config.standardOptions[fieldConfigProp.id]) === null || _g === void 0 ? void 0 : _g.settings;
                if (customDefault) {
                    fieldConfigProp = __assign(__assign({}, fieldConfigProp), { defaultValue: customDefault });
                }
                if (customSettings) {
                    fieldConfigProp = __assign(__assign({}, fieldConfigProp), { settings: fieldConfigProp.settings ? __assign(__assign({}, fieldConfigProp.settings), customSettings) : customSettings });
                }
            }
            registry.register(fieldConfigProp);
            if (fieldConfigProp.category && standardOptionsExtensions[fieldConfigProp.category[0]]) {
                try {
                    for (var _k = (e_3 = void 0, __values(standardOptionsExtensions[fieldConfigProp.category[0]])), _l = _k.next(); !_l.done; _l = _k.next()) {
                        var extensionProperty = _l.value;
                        registry.register(extensionProperty);
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (_l && !_l.done && (_c = _k.return)) _c.call(_k);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (standardConfigs_1_1 && !standardConfigs_1_1.done && (_b = standardConfigs_1.return)) _b.call(standardConfigs_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    try {
        // assert that field configs do not use array path syntax
        for (var _m = __values(registry.list()), _o = _m.next(); !_o.done; _o = _m.next()) {
            var item = _o.value;
            if (item.path.indexOf('[') > 0) {
                throw new Error("[" + pluginName + "] Field config paths do not support arrays: " + item.id);
            }
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (_o && !_o.done && (_d = _m.return)) _d.call(_m);
        }
        finally { if (e_4) throw e_4.error; }
    }
    return registry;
}
function isStandardConfigExtension(property, standardProperties) {
    return Boolean(standardProperties.find(function (p) { return property.category && p.category && property.category[0] === p.category[0]; }));
}
//# sourceMappingURL=registryFactories.js.map