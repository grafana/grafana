import { __assign, __read, __spreadArray, __values } from "tslib";
import { FieldColorModeId, fieldColorModeRegistry, FieldConfigProperty, ThresholdsMode, } from '@grafana/data';
import { mergeWith, isArray, isObject, unset, isEqual } from 'lodash';
export function getPanelOptionsWithDefaults(_a) {
    var plugin = _a.plugin, currentOptions = _a.currentOptions, currentFieldConfig = _a.currentFieldConfig, isAfterPluginChange = _a.isAfterPluginChange;
    var optionsWithDefaults = mergeWith({}, plugin.defaults, currentOptions || {}, function (objValue, srcValue) {
        if (isArray(srcValue)) {
            return srcValue;
        }
    });
    var fieldConfigWithDefaults = applyFieldConfigDefaults(currentFieldConfig, plugin);
    var fieldConfigWithOptimalColorMode = adaptFieldColorMode(plugin, fieldConfigWithDefaults, isAfterPluginChange);
    return { options: optionsWithDefaults, fieldConfig: fieldConfigWithOptimalColorMode };
}
function applyFieldConfigDefaults(existingFieldConfig, plugin) {
    var e_1, _a, e_2, _b;
    var _c;
    var pluginDefaults = plugin.fieldConfigDefaults;
    var result = {
        defaults: mergeWith({}, pluginDefaults.defaults, existingFieldConfig ? existingFieldConfig.defaults : {}, function (objValue, srcValue) {
            if (isArray(srcValue)) {
                return srcValue;
            }
        }),
        overrides: (_c = existingFieldConfig === null || existingFieldConfig === void 0 ? void 0 : existingFieldConfig.overrides) !== null && _c !== void 0 ? _c : [],
    };
    cleanProperties(result.defaults, '', plugin.fieldConfigRegistry);
    // Thresholds base values are null in JSON but need to be converted to -Infinity
    if (result.defaults.thresholds) {
        fixThresholds(result.defaults.thresholds);
    }
    // Filter out overrides for properties that cannot be found in registry
    result.overrides = filterFieldConfigOverrides(result.overrides, function (prop) {
        return plugin.fieldConfigRegistry.getIfExists(prop.id) !== undefined;
    });
    try {
        for (var _d = __values(result.overrides), _e = _d.next(); !_e.done; _e = _d.next()) {
            var override = _e.value;
            try {
                for (var _f = (e_2 = void 0, __values(override.properties)), _g = _f.next(); !_g.done; _g = _f.next()) {
                    var property = _g.value;
                    if (property.id === 'thresholds') {
                        fixThresholds(property.value);
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_g && !_g.done && (_b = _f.return)) _b.call(_f);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return result;
}
export function filterFieldConfigOverrides(overrides, condition) {
    return overrides
        .map(function (x) {
        var properties = x.properties.filter(condition);
        return __assign(__assign({}, x), { properties: properties });
    })
        .filter(function (x) { return x.properties.length > 0; });
}
function cleanProperties(obj, parentPath, fieldConfigRegistry) {
    var e_3, _a;
    var found = false;
    try {
        for (var _b = __values(Object.keys(obj)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var propName = _c.value;
            var value = obj[propName];
            var fullPath = "" + parentPath + propName;
            var existsInRegistry = !!fieldConfigRegistry.getIfExists(fullPath);
            // need to check early here as some standard properties have nested properies
            if (existsInRegistry) {
                found = true;
                continue;
            }
            if (isArray(value) || !isObject(value)) {
                if (!existsInRegistry) {
                    unset(obj, propName);
                }
            }
            else {
                var childPropFound = cleanProperties(value, fullPath + ".", fieldConfigRegistry);
                // If no child props found unset the main object
                if (!childPropFound) {
                    unset(obj, propName);
                }
            }
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return found;
}
function adaptFieldColorMode(plugin, fieldConfig, isAfterPluginChange) {
    var _a;
    if (!isAfterPluginChange) {
        return fieldConfig;
    }
    // adjust to prefered field color setting if needed
    var color = plugin.fieldConfigRegistry.getIfExists(FieldConfigProperty.Color);
    if (color && color.settings) {
        var colorSettings = color.settings;
        var mode = fieldColorModeRegistry.getIfExists((_a = fieldConfig.defaults.color) === null || _a === void 0 ? void 0 : _a.mode);
        // When no support fo value colors, use classic palette
        if (!colorSettings.byValueSupport) {
            if (!mode || mode.isByValue) {
                fieldConfig.defaults.color = { mode: FieldColorModeId.PaletteClassic };
                return fieldConfig;
            }
        }
        // When supporting value colors and prefering thresholds, use Thresholds mode.
        // Otherwise keep current mode
        if (colorSettings.byValueSupport && colorSettings.preferThresholdsMode && (mode === null || mode === void 0 ? void 0 : mode.id) !== FieldColorModeId.Fixed) {
            if (!mode || !mode.isByValue) {
                fieldConfig.defaults.color = { mode: FieldColorModeId.Thresholds };
                return fieldConfig;
            }
        }
        // If panel support bySeries then we should default to that when switching to this panel as that is most likely
        // what users will expect. Example scenario a user who has a graph panel (time series) and switches to Gauge and
        // then back to time series we want the graph panel color mode to reset to classic palette and not preserve the
        // Gauge prefered thresholds mode.
        if (colorSettings.bySeriesSupport && (mode === null || mode === void 0 ? void 0 : mode.isByValue)) {
            fieldConfig.defaults.color = { mode: FieldColorModeId.PaletteClassic };
            return fieldConfig;
        }
    }
    return fieldConfig;
}
function fixThresholds(thresholds) {
    if (!thresholds.mode) {
        thresholds.mode = ThresholdsMode.Absolute;
    }
    if (!thresholds.steps) {
        thresholds.steps = [];
    }
    else if (thresholds.steps.length) {
        // First value is always -Infinity
        // JSON saves it as null
        thresholds.steps[0].value = -Infinity;
    }
}
export function restoreCustomOverrideRules(current, old) {
    var e_4, _a;
    var result = {
        defaults: __assign(__assign({}, current.defaults), { custom: old.defaults.custom }),
        overrides: __spreadArray([], __read(current.overrides), false),
    };
    var _loop_1 = function (override) {
        var e_5, _d;
        try {
            for (var _e = (e_5 = void 0, __values(override.properties)), _f = _e.next(); !_f.done; _f = _e.next()) {
                var prop = _f.value;
                if (isCustomFieldProp(prop)) {
                    var currentOverride = result.overrides.find(function (o) { return isEqual(o.matcher, override.matcher); });
                    if (currentOverride) {
                        if (currentOverride !== override) {
                            currentOverride.properties.push(prop);
                        }
                    }
                    else {
                        result.overrides.push(override);
                    }
                }
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (_f && !_f.done && (_d = _e.return)) _d.call(_e);
            }
            finally { if (e_5) throw e_5.error; }
        }
    };
    try {
        for (var _b = __values(old.overrides), _c = _b.next(); !_c.done; _c = _b.next()) {
            var override = _c.value;
            _loop_1(override);
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_4) throw e_4.error; }
    }
    return result;
}
export function isCustomFieldProp(prop) {
    return prop.id.startsWith('custom.');
}
export function isStandardFieldProp(prop) {
    return !isCustomFieldProp(prop);
}
//# sourceMappingURL=getPanelOptionsWithDefaults.js.map