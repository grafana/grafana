import { __assign, __values } from "tslib";
import { toString, isEmpty } from 'lodash';
import { getDisplayProcessor } from './displayProcessor';
import { FieldType, } from '../types';
import { DataFrameView } from '../dataframe/DataFrameView';
import { reduceField, ReducerID } from '../transformations/fieldReducer';
import { getTimeField } from '../dataframe/processDataFrame';
import { getFieldMatcher } from '../transformations';
import { FieldMatcherID } from '../transformations/matchers/ids';
import { getFieldDisplayName } from './fieldState';
// TODO: use built in variables, same as for data links?
export var VAR_SERIES_NAME = '__series.name';
export var VAR_FIELD_NAME = '__field.displayName'; // Includes the rendered tags and naming strategy
export var VAR_FIELD_LABELS = '__field.labels';
export var VAR_CALC = '__calc';
export var VAR_CELL_PREFIX = '__cell_'; // consistent with existing table templates
export var DEFAULT_FIELD_DISPLAY_VALUES_LIMIT = 25;
export var getFieldDisplayValues = function (options) {
    var _a, _b, _c, _d, _e, _f;
    var replaceVariables = options.replaceVariables, reduceOptions = options.reduceOptions, timeZone = options.timeZone, theme = options.theme;
    var calcs = reduceOptions.calcs.length ? reduceOptions.calcs : [ReducerID.last];
    var values = [];
    var fieldMatcher = getFieldMatcher(reduceOptions.fields
        ? {
            id: FieldMatcherID.byRegexp,
            options: reduceOptions.fields,
        }
        : {
            id: FieldMatcherID.numeric,
        });
    var data = (_a = options.data) !== null && _a !== void 0 ? _a : [];
    var limit = reduceOptions.limit ? reduceOptions.limit : DEFAULT_FIELD_DISPLAY_VALUES_LIMIT;
    var scopedVars = {};
    var hitLimit = false;
    for (var s = 0; s < data.length && !hitLimit; s++) {
        var dataFrame = data[s]; // Name is already set
        var timeField = getTimeField(dataFrame).timeField;
        var view = new DataFrameView(dataFrame);
        var _loop_1 = function (i) {
            var e_1, _g;
            var field = dataFrame.fields[i];
            var fieldLinksSupplier = field.getLinks;
            // To filter out time field, need an option for this
            if (!fieldMatcher(field, dataFrame, data)) {
                return "continue";
            }
            var config = field.config; // already set by the prepare task
            if ((_b = field.state) === null || _b === void 0 ? void 0 : _b.range) {
                // Us the global min/max values
                config = __assign(__assign({}, config), (_c = field.state) === null || _c === void 0 ? void 0 : _c.range);
            }
            var displayName = (_d = field.config.displayName) !== null && _d !== void 0 ? _d : '';
            var display = (_e = field.display) !== null && _e !== void 0 ? _e : getDisplayProcessor({
                field: field,
                theme: options.theme,
                timeZone: timeZone,
            });
            // Show all rows
            if (reduceOptions.values) {
                var usesCellValues = displayName.indexOf(VAR_CELL_PREFIX) >= 0;
                var _loop_2 = function (j) {
                    // Add all the row variables
                    if (usesCellValues) {
                        for (var k = 0; k < dataFrame.fields.length; k++) {
                            var f = dataFrame.fields[k];
                            var v = f.values.get(j);
                            scopedVars[VAR_CELL_PREFIX + k] = {
                                value: v,
                                text: toString(v),
                            };
                        }
                    }
                    field.state = setIndexForPaletteColor(field, values.length);
                    var displayValue = display(field.values.get(j));
                    var rowName = getSmartDisplayNameForRow(dataFrame, field, j, replaceVariables, scopedVars);
                    var overrideColor = lookupRowColorFromOverride(rowName, options.fieldConfig, theme);
                    values.push({
                        name: '',
                        field: config,
                        display: __assign(__assign({}, displayValue), { title: rowName, color: overrideColor !== null && overrideColor !== void 0 ? overrideColor : displayValue.color }),
                        view: view,
                        colIndex: i,
                        rowIndex: j,
                        getLinks: fieldLinksSupplier
                            ? function () {
                                return fieldLinksSupplier({
                                    valueRowIndex: j,
                                });
                            }
                            : function () { return []; },
                        hasLinks: hasLinks(field),
                    });
                    if (values.length >= limit) {
                        hitLimit = true;
                        return "break";
                    }
                };
                for (var j = 0; j < field.values.length; j++) {
                    var state_1 = _loop_2(j);
                    if (state_1 === "break")
                        break;
                }
            }
            else {
                var results = reduceField({
                    field: field,
                    reducers: calcs, // The stats to calculate
                });
                var _loop_3 = function (calc) {
                    scopedVars[VAR_CALC] = { value: calc, text: calc };
                    var displayValue = display(results[calc]);
                    if (displayName !== '') {
                        displayValue.title = replaceVariables(displayName, __assign(__assign({}, (_f = field.state) === null || _f === void 0 ? void 0 : _f.scopedVars), scopedVars));
                    }
                    else {
                        displayValue.title = getFieldDisplayName(field, dataFrame, data);
                    }
                    var sparkline = undefined;
                    if (options.sparkline) {
                        sparkline = {
                            y: dataFrame.fields[i],
                            x: timeField,
                        };
                        if (calc === ReducerID.last) {
                            sparkline.highlightIndex = sparkline.y.values.length - 1;
                        }
                        else if (calc === ReducerID.first) {
                            sparkline.highlightIndex = 0;
                        }
                    }
                    values.push({
                        name: calc,
                        field: config,
                        display: displayValue,
                        sparkline: sparkline,
                        view: view,
                        colIndex: i,
                        getLinks: fieldLinksSupplier
                            ? function () {
                                return fieldLinksSupplier({
                                    calculatedValue: displayValue,
                                });
                            }
                            : function () { return []; },
                        hasLinks: hasLinks(field),
                    });
                };
                try {
                    for (var calcs_1 = (e_1 = void 0, __values(calcs)), calcs_1_1 = calcs_1.next(); !calcs_1_1.done; calcs_1_1 = calcs_1.next()) {
                        var calc = calcs_1_1.value;
                        _loop_3(calc);
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (calcs_1_1 && !calcs_1_1.done && (_g = calcs_1.return)) _g.call(calcs_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }
        };
        for (var i = 0; i < dataFrame.fields.length && !hitLimit; i++) {
            _loop_1(i);
        }
    }
    if (values.length === 0) {
        values.push(createNoValuesFieldDisplay(options));
    }
    return values;
};
function getSmartDisplayNameForRow(frame, field, rowIndex, replaceVariables, scopedVars) {
    var e_2, _a;
    var _b, _c;
    var parts = [];
    var otherNumericFields = 0;
    if (field.config.displayName) {
        return replaceVariables(field.config.displayName, __assign(__assign({}, (_b = field.state) === null || _b === void 0 ? void 0 : _b.scopedVars), scopedVars));
    }
    try {
        for (var _d = __values(frame.fields), _e = _d.next(); !_e.done; _e = _d.next()) {
            var otherField = _e.value;
            if (otherField === field) {
                continue;
            }
            if (otherField.type === FieldType.string) {
                var value = (_c = otherField.values.get(rowIndex)) !== null && _c !== void 0 ? _c : '';
                var mappedValue = otherField.display ? otherField.display(value).text : value;
                if (mappedValue.length > 0) {
                    parts.push(mappedValue);
                }
            }
            else if (otherField.type === FieldType.number) {
                otherNumericFields++;
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
        }
        finally { if (e_2) throw e_2.error; }
    }
    if (otherNumericFields || parts.length === 0) {
        parts.push(getFieldDisplayName(field, frame));
    }
    return parts.join(' ');
}
/**
 * Palette color modes use series index (field index) which does not work for when displaing rows
 * So updating seriesIndex here makes the palette color modes work in "All values" mode
 */
function setIndexForPaletteColor(field, currentLength) {
    return __assign(__assign({}, field.state), { seriesIndex: currentLength });
}
/**
 * This function makes overrides that set color work for row values
 */
function lookupRowColorFromOverride(displayName, fieldConfig, theme) {
    var e_3, _a, e_4, _b;
    try {
        for (var _c = __values(fieldConfig.overrides), _d = _c.next(); !_d.done; _d = _c.next()) {
            var override = _d.value;
            if (override.matcher.id === 'byName' && override.matcher.options === displayName) {
                try {
                    for (var _e = (e_4 = void 0, __values(override.properties)), _f = _e.next(); !_f.done; _f = _e.next()) {
                        var prop = _f.value;
                        if (prop.id === 'color' && prop.value) {
                            return theme.visualization.getColorByName(prop.value.fixedColor);
                        }
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                    }
                    finally { if (e_4) throw e_4.error; }
                }
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
    return null;
}
export function hasLinks(field) {
    var _a, _b;
    return ((_b = (_a = field.config) === null || _a === void 0 ? void 0 : _a.links) === null || _b === void 0 ? void 0 : _b.length) ? field.config.links.length > 0 : false;
}
export function getDisplayValueAlignmentFactors(values) {
    var info = {
        title: '',
        text: '',
    };
    var prefixLength = 0;
    var suffixLength = 0;
    for (var i = 0; i < values.length; i++) {
        var v = values[i].display;
        if (v.text && v.text.length > info.text.length) {
            info.text = v.text;
        }
        if (v.title && v.title.length > info.title.length) {
            info.title = v.title;
        }
        if (v.prefix && v.prefix.length > prefixLength) {
            info.prefix = v.prefix;
            prefixLength = v.prefix.length;
        }
        if (v.suffix && v.suffix.length > suffixLength) {
            info.suffix = v.suffix;
            suffixLength = v.suffix.length;
        }
    }
    return info;
}
function createNoValuesFieldDisplay(options) {
    var _a, _b;
    var displayName = 'No data';
    var fieldConfig = options.fieldConfig, timeZone = options.timeZone;
    var defaults = fieldConfig.defaults;
    var displayProcessor = getDisplayProcessor({
        field: {
            type: FieldType.other,
            config: defaults,
        },
        theme: options.theme,
        timeZone: timeZone,
    });
    var display = displayProcessor(null);
    var text = getDisplayText(display, displayName);
    return {
        name: displayName,
        field: __assign(__assign({}, defaults), { max: (_a = defaults.max) !== null && _a !== void 0 ? _a : 0, min: (_b = defaults.min) !== null && _b !== void 0 ? _b : 0 }),
        display: {
            text: text,
            numeric: 0,
            color: display.color,
        },
        hasLinks: false,
    };
}
function getDisplayText(display, fallback) {
    if (!display || isEmpty(display.text)) {
        return fallback;
    }
    return display.text;
}
//# sourceMappingURL=fieldDisplay.js.map