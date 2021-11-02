import { __assign, __read, __spreadArray, __values } from "tslib";
import { ByNamesMatcherMode, FieldMatcherID, FieldType, getFieldDisplayName, isSystemOverrideWithRef, } from '@grafana/data';
import { SeriesVisibilityChangeMode } from '@grafana/ui';
var displayOverrideRef = 'hideSeriesFrom';
var isHideSeriesOverride = isSystemOverrideWithRef(displayOverrideRef);
export var hideSeriesConfigFactory = function (event, fieldConfig, data) {
    var fieldIndex = event.fieldIndex, mode = event.mode;
    var overrides = fieldConfig.overrides;
    var frame = data[fieldIndex.frameIndex];
    if (!frame) {
        return fieldConfig;
    }
    var field = frame.fields[fieldIndex.fieldIndex];
    if (!field) {
        return fieldConfig;
    }
    var displayName = getFieldDisplayName(field, frame, data);
    var currentIndex = overrides.findIndex(isHideSeriesOverride);
    if (currentIndex < 0) {
        if (mode === SeriesVisibilityChangeMode.ToggleSelection) {
            var override_1 = createOverride([displayName]);
            return __assign(__assign({}, fieldConfig), { overrides: __spreadArray([override_1], __read(fieldConfig.overrides), false) });
        }
        var displayNames = getDisplayNames(data, displayName);
        var override_2 = createOverride(displayNames);
        return __assign(__assign({}, fieldConfig), { overrides: __spreadArray([override_2], __read(fieldConfig.overrides), false) });
    }
    var overridesCopy = Array.from(overrides);
    var _a = __read(overridesCopy.splice(currentIndex, 1), 1), current = _a[0];
    if (mode === SeriesVisibilityChangeMode.ToggleSelection) {
        var existing = getExistingDisplayNames(current);
        if (existing[0] === displayName && existing.length === 1) {
            return __assign(__assign({}, fieldConfig), { overrides: overridesCopy });
        }
        var override_3 = createOverride([displayName]);
        return __assign(__assign({}, fieldConfig), { overrides: __spreadArray([override_3], __read(overridesCopy), false) });
    }
    var override = createExtendedOverride(current, displayName);
    if (allFieldsAreExcluded(override, data)) {
        return __assign(__assign({}, fieldConfig), { overrides: overridesCopy });
    }
    return __assign(__assign({}, fieldConfig), { overrides: __spreadArray([override], __read(overridesCopy), false) });
};
var createExtendedOverride = function (current, displayName) {
    var property = current.properties.find(function (p) { return p.id === 'custom.hideFrom'; });
    var existing = getExistingDisplayNames(current);
    var index = existing.findIndex(function (name) { return name === displayName; });
    if (index < 0) {
        existing.push(displayName);
    }
    else {
        existing.splice(index, 1);
    }
    return createOverride(existing, property);
};
var getExistingDisplayNames = function (rule) {
    var _a;
    var names = (_a = rule.matcher.options) === null || _a === void 0 ? void 0 : _a.names;
    if (!Array.isArray(names)) {
        return [];
    }
    return names;
};
var createOverride = function (names, property) {
    property = property !== null && property !== void 0 ? property : {
        id: 'custom.hideFrom',
        value: {
            graph: true,
            legend: false,
            tooltip: false,
        },
    };
    return {
        __systemRef: displayOverrideRef,
        matcher: {
            id: FieldMatcherID.byNames,
            options: {
                mode: ByNamesMatcherMode.exclude,
                names: names,
                prefix: 'All except:',
                readOnly: true,
            },
        },
        properties: [
            __assign(__assign({}, property), { value: {
                    graph: true,
                    legend: false,
                    tooltip: false,
                } }),
        ],
    };
};
var allFieldsAreExcluded = function (override, data) {
    return getExistingDisplayNames(override).length === getDisplayNames(data).length;
};
var getDisplayNames = function (data, excludeName) {
    var e_1, _a, e_2, _b;
    var unique = new Set();
    try {
        for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
            var frame = data_1_1.value;
            try {
                for (var _c = (e_2 = void 0, __values(frame.fields)), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var field = _d.value;
                    if (field.type !== FieldType.number) {
                        continue;
                    }
                    var name_1 = getFieldDisplayName(field, frame, data);
                    if (name_1 === excludeName) {
                        continue;
                    }
                    unique.add(name_1);
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
    return Array.from(unique);
};
//# sourceMappingURL=hideSeriesConfigFactory.js.map