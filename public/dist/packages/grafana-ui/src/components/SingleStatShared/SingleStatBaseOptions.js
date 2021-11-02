import { __assign, __read, __rest, __spreadArray, __values } from "tslib";
import { cloneDeep, isNumber, omit } from 'lodash';
import { convertOldAngularValueMappings, FieldColorModeId, fieldReducers, ReducerID, sortThresholds, ThresholdsMode, validateFieldConfig, VizOrientation, } from '@grafana/data';
var optionsToKeep = ['reduceOptions', 'orientation'];
export function sharedSingleStatPanelChangedHandler(panel, prevPluginId, prevOptions) {
    var e_1, _a;
    var options = panel.options;
    panel.fieldConfig = panel.fieldConfig || {
        defaults: {},
        overrides: [],
    };
    // Migrating from angular singlestat
    if (prevPluginId === 'singlestat' && prevOptions.angular) {
        return migrateFromAngularSinglestat(panel, prevOptions);
    }
    try {
        for (var optionsToKeep_1 = __values(optionsToKeep), optionsToKeep_1_1 = optionsToKeep_1.next(); !optionsToKeep_1_1.done; optionsToKeep_1_1 = optionsToKeep_1.next()) {
            var k = optionsToKeep_1_1.value;
            if (prevOptions.hasOwnProperty(k)) {
                options[k] = cloneDeep(prevOptions[k]);
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (optionsToKeep_1_1 && !optionsToKeep_1_1.done && (_a = optionsToKeep_1.return)) _a.call(optionsToKeep_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return options;
}
function migrateFromAngularSinglestat(panel, prevOptions) {
    var e_2, _a;
    var prevPanel = prevOptions.angular;
    var reducer = fieldReducers.getIfExists(prevPanel.valueName);
    var options = {
        reduceOptions: {
            calcs: [reducer ? reducer.id : ReducerID.mean],
        },
        orientation: VizOrientation.Horizontal,
    };
    var defaults = {};
    if (prevPanel.format) {
        defaults.unit = prevPanel.format;
    }
    if (prevPanel.tableColumn) {
        options.reduceOptions.fields = "/^" + prevPanel.tableColumn + "$/";
    }
    if (prevPanel.nullPointMode) {
        defaults.nullValueMode = prevPanel.nullPointMode;
    }
    if (prevPanel.nullText) {
        defaults.noValue = prevPanel.nullText;
    }
    if (prevPanel.decimals || prevPanel.decimals === 0) {
        defaults.decimals = prevPanel.decimals;
    }
    // Convert thresholds and color values
    if (prevPanel.thresholds && prevPanel.colors) {
        var levels = prevPanel.thresholds.split(',').map(function (strVale) {
            return Number(strVale.trim());
        });
        // One more color than threshold
        var thresholds = [];
        try {
            for (var _b = __values(prevPanel.colors), _c = _b.next(); !_c.done; _c = _b.next()) {
                var color = _c.value;
                var idx = thresholds.length - 1;
                if (idx >= 0) {
                    thresholds.push({ value: levels[idx], color: color });
                }
                else {
                    thresholds.push({ value: -Infinity, color: color });
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        defaults.thresholds = {
            mode: ThresholdsMode.Absolute,
            steps: thresholds,
        };
    }
    // Convert value mappings
    var mappings = convertOldAngularValueMappings(prevPanel, defaults.thresholds);
    if (mappings && mappings.length) {
        defaults.mappings = mappings;
    }
    if (prevPanel.gauge && prevPanel.gauge.show) {
        defaults.min = prevPanel.gauge.minValue;
        defaults.max = prevPanel.gauge.maxValue;
    }
    panel.fieldConfig.defaults = defaults;
    return options;
}
export function sharedSingleStatMigrationHandler(panel) {
    var _a, _b;
    if (!panel.options) {
        // This happens on the first load or when migrating from angular
        return {};
    }
    var previousVersion = parseFloat(panel.pluginVersion || '6.1');
    var options = panel.options;
    if (previousVersion < 6.2) {
        options = migrateFromValueOptions(options);
    }
    if (previousVersion < 6.3) {
        options = moveThresholdsAndMappingsToField(options);
    }
    var fieldOptions = options.fieldOptions;
    if (previousVersion < 6.6 && fieldOptions) {
        // discard the old `override` options and enter an empty array
        if (fieldOptions && fieldOptions.override) {
            var _c = options.fieldOptions, override = _c.override, rest = __rest(_c, ["override"]);
            options = __assign(__assign({}, options), { fieldOptions: __assign(__assign({}, rest), { overrides: [] }) });
        }
        // Move thresholds to steps
        var thresholds = (_a = fieldOptions === null || fieldOptions === void 0 ? void 0 : fieldOptions.defaults) === null || _a === void 0 ? void 0 : _a.thresholds;
        if (thresholds) {
            delete fieldOptions.defaults.thresholds;
        }
        else {
            thresholds = fieldOptions === null || fieldOptions === void 0 ? void 0 : fieldOptions.thresholds;
            delete fieldOptions.thresholds;
        }
        if (thresholds) {
            fieldOptions.defaults.thresholds = {
                mode: ThresholdsMode.Absolute,
                steps: thresholds,
            };
        }
        // Migrate color from simple string to a mode
        var defaults = fieldOptions.defaults;
        if (defaults.color && typeof defaults.color === 'string') {
            defaults.color = {
                mode: FieldColorModeId.Fixed,
                fixedColor: defaults.color,
            };
        }
        validateFieldConfig(defaults);
    }
    if (previousVersion < 7.0) {
        panel.fieldConfig = panel.fieldConfig || { defaults: {}, overrides: [] };
        panel.fieldConfig = {
            defaults: fieldOptions && fieldOptions.defaults
                ? __assign(__assign({}, panel.fieldConfig.defaults), fieldOptions.defaults) : panel.fieldConfig.defaults,
            overrides: fieldOptions && fieldOptions.overrides
                ? __spreadArray(__spreadArray([], __read(panel.fieldConfig.overrides), false), __read(fieldOptions.overrides), false) : panel.fieldConfig.overrides,
        };
        if (fieldOptions) {
            options.reduceOptions = {
                values: fieldOptions.values,
                limit: fieldOptions.limit,
                calcs: fieldOptions.calcs,
            };
        }
        delete options.fieldOptions;
    }
    if (previousVersion < 7.1) {
        // move title to displayName
        var oldTitle = panel.fieldConfig.defaults.title;
        if (oldTitle !== undefined && oldTitle !== null) {
            panel.fieldConfig.defaults.displayName = oldTitle;
            delete panel.fieldConfig.defaults.title;
        }
    }
    if (previousVersion < 8.0) {
        // Explicit min/max was removed for percent/percentunit in 8.0
        var config = (_b = panel.fieldConfig) === null || _b === void 0 ? void 0 : _b.defaults;
        var unit = config === null || config === void 0 ? void 0 : config.unit;
        if (unit === 'percent') {
            if (!isNumber(config.min)) {
                config.min = 0;
            }
            if (!isNumber(config.max)) {
                config.max = 100;
            }
        }
        else if (unit === 'percentunit') {
            if (!isNumber(config.min)) {
                config.min = 0;
            }
            if (!isNumber(config.max)) {
                config.max = 1;
            }
        }
    }
    return options;
}
export function moveThresholdsAndMappingsToField(old) {
    var fieldOptions = old.fieldOptions;
    if (!fieldOptions) {
        return old;
    }
    var _a = old.fieldOptions, mappings = _a.mappings, rest = __rest(_a, ["mappings"]);
    var thresholds = undefined;
    if (old.thresholds) {
        thresholds = {
            mode: ThresholdsMode.Absolute,
            steps: migrateOldThresholds(old.thresholds),
        };
    }
    return __assign(__assign({}, old), { fieldOptions: __assign(__assign({}, rest), { defaults: __assign(__assign({}, fieldOptions.defaults), { mappings: mappings, thresholds: thresholds }) }) });
}
/*
 * Moves valueMappings and thresholds from root to new fieldOptions object
 * Renames valueOptions to to defaults and moves it under fieldOptions
 */
export function migrateFromValueOptions(old) {
    var valueOptions = old.valueOptions;
    if (!valueOptions) {
        return old;
    }
    var fieldOptions = {};
    var fieldDefaults = {};
    fieldOptions.mappings = old.valueMappings;
    fieldOptions.thresholds = old.thresholds;
    fieldOptions.defaults = fieldDefaults;
    fieldDefaults.unit = valueOptions.unit;
    fieldDefaults.decimals = valueOptions.decimals;
    // Make sure the stats have a valid name
    if (valueOptions.stat) {
        var reducer = fieldReducers.get(valueOptions.stat);
        if (reducer) {
            fieldOptions.calcs = [reducer.id];
        }
    }
    fieldDefaults.min = old.minValue;
    fieldDefaults.max = old.maxValue;
    var newOptions = __assign(__assign({}, old), { fieldOptions: fieldOptions });
    return omit(newOptions, 'valueMappings', 'thresholds', 'valueOptions', 'minValue', 'maxValue');
}
export function migrateOldThresholds(thresholds) {
    if (!thresholds || !thresholds.length) {
        return undefined;
    }
    var copy = thresholds.map(function (t) {
        return {
            // Drops 'index'
            value: t.value === null ? -Infinity : t.value,
            color: t.color,
        };
    });
    sortThresholds(copy);
    copy[0].value = -Infinity;
    return copy;
}
/**
 * @deprecated use convertOldAngularValueMappings instead
 * Convert the angular single stat mapping to new react style
 */
export function convertOldAngularValueMapping(panel) {
    return convertOldAngularValueMappings(panel);
}
//# sourceMappingURL=SingleStatBaseOptions.js.map