import { __assign, __read, __spreadArray, __values } from "tslib";
import { FieldColorModeId, FieldType, } from '../types';
import { fieldMatchers, reduceField, ReducerID } from '../transformations';
import { isNumber, set, unset, get, cloneDeep } from 'lodash';
import { getDisplayProcessor, getRawDisplayProcessor } from './displayProcessor';
import { guessFieldTypeForField } from '../dataframe';
import { standardFieldConfigEditorRegistry } from './standardFieldConfigEditorRegistry';
import { DataLinkBuiltInVars, locationUtil } from '../utils';
import { formattedValueToString } from '../valueFormats';
import { getFieldDisplayValuesProxy } from './getFieldDisplayValuesProxy';
import { getFrameDisplayName } from './fieldState';
import { getTimeField } from '../dataframe/processDataFrame';
import { mapInternalLinkToExplore } from '../utils/dataLinks';
import { getTemplateProxyForField } from './templateProxies';
import { asHexString } from '../themes/colorManipulator';
export function findNumericFieldMinMax(data) {
    var e_1, _a, e_2, _b;
    var min = null;
    var max = null;
    var reducers = [ReducerID.min, ReducerID.max];
    try {
        for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
            var frame = data_1_1.value;
            try {
                for (var _c = (e_2 = void 0, __values(frame.fields)), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var field = _d.value;
                    if (field.type === FieldType.number) {
                        var stats = reduceField({ field: field, reducers: reducers });
                        var statsMin = stats[ReducerID.min];
                        var statsMax = stats[ReducerID.max];
                        if (min === null || statsMin < min) {
                            min = statsMin;
                        }
                        if (max === null || statsMax > max) {
                            max = statsMax;
                        }
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return { min: min, max: max, delta: (max !== null && max !== void 0 ? max : 0) - (min !== null && min !== void 0 ? min : 0) };
}
/**
 * Return a copy of the DataFrame with all rules applied
 */
export function applyFieldOverrides(options) {
    var e_3, _a;
    var _b;
    if (!options.data) {
        return [];
    }
    var source = options.fieldConfig;
    if (!source) {
        return options.data;
    }
    var fieldConfigRegistry = (_b = options.fieldConfigRegistry) !== null && _b !== void 0 ? _b : standardFieldConfigEditorRegistry;
    var seriesIndex = 0;
    var globalRange = undefined;
    // Prepare the Matchers
    var override = [];
    if (source.overrides) {
        try {
            for (var _c = __values(source.overrides), _d = _c.next(); !_d.done; _d = _c.next()) {
                var rule = _d.value;
                var info = fieldMatchers.get(rule.matcher.id);
                if (info) {
                    override.push({
                        match: info.get(rule.matcher.options),
                        properties: rule.properties,
                    });
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_3) throw e_3.error; }
        }
    }
    return options.data.map(function (originalFrame, index) {
        var e_4, _a, e_5, _b, e_6, _c;
        var _d, _e;
        // Need to define this new frame here as it's passed to the getLinkSupplier function inside the fields loop
        var newFrame = __assign({}, originalFrame);
        // Copy fields
        newFrame.fields = newFrame.fields.map(function (field) {
            return __assign(__assign({}, field), { config: cloneDeep(field.config), state: __assign({}, field.state) });
        });
        var scopedVars = {
            __series: { text: 'Series', value: { name: getFrameDisplayName(newFrame, index) } }, // might be missing
        };
        try {
            for (var _f = __values(newFrame.fields), _g = _f.next(); !_g.done; _g = _f.next()) {
                var field = _g.value;
                var config = field.config;
                field.state.scopedVars = __assign(__assign({}, scopedVars), { __field: {
                        text: 'Field',
                        value: getTemplateProxyForField(field, newFrame, options.data),
                    } });
                var context = {
                    field: field,
                    data: options.data,
                    dataFrameIndex: index,
                    replaceVariables: options.replaceVariables,
                    fieldConfigRegistry: fieldConfigRegistry,
                };
                // Anything in the field config that's not set by the datasource
                // will be filled in by panel's field configuration
                setFieldConfigDefaults(config, source.defaults, context);
                try {
                    // Find any matching rules and then override
                    for (var override_1 = (e_5 = void 0, __values(override)), override_1_1 = override_1.next(); !override_1_1.done; override_1_1 = override_1.next()) {
                        var rule = override_1_1.value;
                        if (rule.match(field, newFrame, options.data)) {
                            try {
                                for (var _h = (e_6 = void 0, __values(rule.properties)), _j = _h.next(); !_j.done; _j = _h.next()) {
                                    var prop = _j.value;
                                    // config.scopedVars is set already here
                                    setDynamicConfigValue(config, prop, context);
                                }
                            }
                            catch (e_6_1) { e_6 = { error: e_6_1 }; }
                            finally {
                                try {
                                    if (_j && !_j.done && (_c = _h.return)) _c.call(_h);
                                }
                                finally { if (e_6) throw e_6.error; }
                            }
                        }
                    }
                }
                catch (e_5_1) { e_5 = { error: e_5_1 }; }
                finally {
                    try {
                        if (override_1_1 && !override_1_1.done && (_b = override_1.return)) _b.call(override_1);
                    }
                    finally { if (e_5) throw e_5.error; }
                }
                // Try harder to set a real value that is not 'other'
                var type = field.type;
                if (!type || type === FieldType.other) {
                    var t = guessFieldTypeForField(field);
                    if (t) {
                        type = t;
                    }
                }
                // Set the Min/Max value automatically
                var range = undefined;
                if (field.type === FieldType.number) {
                    if (!globalRange && (!isNumber(config.min) || !isNumber(config.max))) {
                        globalRange = findNumericFieldMinMax(options.data);
                    }
                    var min = (_d = config.min) !== null && _d !== void 0 ? _d : globalRange.min;
                    var max = (_e = config.max) !== null && _e !== void 0 ? _e : globalRange.max;
                    range = { min: min, max: max, delta: max - min };
                }
                field.state.seriesIndex = seriesIndex;
                field.state.range = range;
                field.type = type;
                // Some color modes needs series index to assign field color so we count
                // up series index here but ignore time fields
                if (field.type !== FieldType.time) {
                    seriesIndex++;
                }
                // and set the display processor using it
                field.display = getDisplayProcessor({
                    field: field,
                    theme: options.theme,
                    timeZone: options.timeZone,
                });
                // Wrap the display with a cache to avoid double calls
                if (field.config.unit !== 'dateTimeFromNow') {
                    field.display = cachingDisplayProcessor(field.display, 2500);
                }
                // Attach data links supplier
                field.getLinks = getLinksSupplier(newFrame, field, field.state.scopedVars, context.replaceVariables, options.timeZone);
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_g && !_g.done && (_a = _f.return)) _a.call(_f);
            }
            finally { if (e_4) throw e_4.error; }
        }
        return newFrame;
    });
}
// this is a significant optimization for streaming, where we currently re-process all values in the buffer on ech update
// via field.display(value). this can potentially be removed once we...
// 1. process data packets incrementally and/if cache the results in the streaming datafame (maybe by buffer index)
// 2. have the ability to selectively get display color or text (but not always both, which are each quite expensive)
// 3. sufficently optimize text formating and threshold color determinitation
function cachingDisplayProcessor(disp, maxCacheSize) {
    if (maxCacheSize === void 0) { maxCacheSize = 2500; }
    var cache = new Map();
    return function (value) {
        var v = cache.get(value);
        if (!v) {
            // Don't grow too big
            if (cache.size === maxCacheSize) {
                cache.clear();
            }
            v = disp(value);
            // convert to hex6 or hex8 so downstream we can cheaply test for alpha (and set new alpha)
            // via a simple length check (in colorManipulator) rather using slow parsing via tinycolor
            if (v.color) {
                v.color = asHexString(v.color);
            }
            cache.set(value, v);
        }
        return v;
    };
}
export function setDynamicConfigValue(config, value, context) {
    var reg = context.fieldConfigRegistry;
    var item = reg.getIfExists(value.id);
    if (!item) {
        return;
    }
    var val = item.process(value.value, context, item.settings);
    var remove = val === undefined || val === null;
    if (remove) {
        if (item.isCustom && config.custom) {
            unset(config.custom, item.path);
        }
        else {
            unset(config, item.path);
        }
    }
    else {
        if (item.isCustom) {
            if (!config.custom) {
                config.custom = {};
            }
            set(config.custom, item.path, val);
        }
        else {
            set(config, item.path, val);
        }
    }
}
// config -> from DS
// defaults -> from Panel config
export function setFieldConfigDefaults(config, defaults, context) {
    var e_7, _a;
    try {
        for (var _b = __values(context.fieldConfigRegistry.list()), _c = _b.next(); !_c.done; _c = _b.next()) {
            var fieldConfigProperty = _c.value;
            if (fieldConfigProperty.isCustom && !config.custom) {
                config.custom = {};
            }
            processFieldConfigValue(fieldConfigProperty.isCustom ? config.custom : config, fieldConfigProperty.isCustom ? defaults.custom : defaults, fieldConfigProperty, context);
        }
    }
    catch (e_7_1) { e_7 = { error: e_7_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_7) throw e_7.error; }
    }
    validateFieldConfig(config);
}
function processFieldConfigValue(destination, // it's mutable
source, fieldConfigProperty, context) {
    var currentConfig = get(destination, fieldConfigProperty.path);
    if (currentConfig === null || currentConfig === undefined) {
        var item = context.fieldConfigRegistry.getIfExists(fieldConfigProperty.id);
        if (!item) {
            return;
        }
        if (item && item.shouldApply(context.field)) {
            var val = item.process(get(source, item.path), context, item.settings);
            if (val !== undefined && val !== null) {
                set(destination, item.path, val);
            }
        }
    }
}
/**
 * This checks that all options on FieldConfig make sense.  It mutates any value that needs
 * fixed.  In particular this makes sure that the first threshold value is -Infinity (not valid in JSON)
 */
export function validateFieldConfig(config) {
    var thresholds = config.thresholds;
    if (!config.color) {
        if (thresholds) {
            config.color = {
                mode: FieldColorModeId.Thresholds,
            };
        }
        // No Color settings
    }
    else if (!config.color.mode) {
        // Without a mode, skip color altogether
        delete config.color;
    }
    // Verify that max > min (swap if necessary)
    if (config.hasOwnProperty('min') && config.hasOwnProperty('max') && config.min > config.max) {
        var tmp = config.max;
        config.max = config.min;
        config.min = tmp;
    }
}
export var getLinksSupplier = function (frame, field, fieldScopedVars, replaceVariables, timeZone) { return function (config) {
    if (!field.config.links || field.config.links.length === 0) {
        return [];
    }
    var timeRangeUrl = locationUtil.getTimeRangeUrlParams();
    var timeField = getTimeField(frame).timeField;
    return field.config.links.map(function (link) {
        var _a;
        var variablesQuery = locationUtil.getVariablesUrlParams();
        var dataFrameVars = {};
        var valueVars = {};
        // We are not displaying reduction result
        if (config.valueRowIndex !== undefined && !isNaN(config.valueRowIndex)) {
            var fieldsProxy = getFieldDisplayValuesProxy({
                frame: frame,
                rowIndex: config.valueRowIndex,
                timeZone: timeZone,
            });
            valueVars = {
                raw: field.values.get(config.valueRowIndex),
                numeric: fieldsProxy[field.name].numeric,
                text: fieldsProxy[field.name].text,
                time: timeField ? timeField.values.get(config.valueRowIndex) : undefined,
            };
            dataFrameVars = {
                __data: {
                    value: {
                        name: frame.name,
                        refId: frame.refId,
                        fields: fieldsProxy,
                    },
                    text: 'Data',
                },
            };
        }
        else {
            if (config.calculatedValue) {
                valueVars = {
                    raw: config.calculatedValue.numeric,
                    numeric: config.calculatedValue.numeric,
                    text: formattedValueToString(config.calculatedValue),
                };
            }
        }
        var variables = __assign(__assign(__assign(__assign({}, fieldScopedVars), { __value: {
                text: 'Value',
                value: valueVars,
            } }), dataFrameVars), (_a = {}, _a[DataLinkBuiltInVars.keepTime] = {
            text: timeRangeUrl,
            value: timeRangeUrl,
        }, _a[DataLinkBuiltInVars.includeVars] = {
            text: variablesQuery,
            value: variablesQuery,
        }, _a));
        if (link.onClick) {
            return {
                href: link.url,
                title: replaceVariables(link.title || '', variables),
                target: link.targetBlank ? '_blank' : undefined,
                onClick: function (evt, origin) {
                    link.onClick({
                        origin: origin !== null && origin !== void 0 ? origin : field,
                        e: evt,
                        replaceVariables: function (v) { return replaceVariables(v, variables); },
                    });
                },
                origin: field,
            };
        }
        if (link.internal) {
            // For internal links at the moment only destination is Explore.
            return mapInternalLinkToExplore({
                link: link,
                internalLink: link.internal,
                scopedVars: variables,
                field: field,
                range: {},
                replaceVariables: replaceVariables,
            });
        }
        var href = locationUtil.assureBaseUrl(link.url.replace(/\n/g, ''));
        href = replaceVariables(href, variables);
        href = locationUtil.processUrl(href);
        var info = {
            href: href,
            title: replaceVariables(link.title || '', variables),
            target: link.targetBlank ? '_blank' : undefined,
            origin: field,
        };
        return info;
    });
}; };
/**
 * Return a copy of the DataFrame with raw data
 */
export function applyRawFieldOverrides(data) {
    if (!data || data.length === 0) {
        return [];
    }
    var newData = __spreadArray([], __read(data), false);
    var processor = getRawDisplayProcessor();
    for (var frameIndex = 0; frameIndex < newData.length; frameIndex++) {
        var newFrame = __assign({}, newData[frameIndex]);
        var newFields = __spreadArray([], __read(newFrame.fields), false);
        for (var fieldIndex = 0; fieldIndex < newFields.length; fieldIndex++) {
            newFields[fieldIndex] = __assign(__assign({}, newFields[fieldIndex]), { display: processor });
        }
        newData[frameIndex] = __assign(__assign({}, newFrame), { fields: newFields });
    }
    return newData;
}
//# sourceMappingURL=fieldOverrides.js.map