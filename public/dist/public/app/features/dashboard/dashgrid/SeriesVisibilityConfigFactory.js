import { __assign, __read, __spreadArray, __values } from "tslib";
import { ByNamesMatcherMode, FieldMatcherID, FieldType, getFieldDisplayName, isSystemOverrideWithRef, } from '@grafana/data';
import { SeriesVisibilityChangeMode } from '@grafana/ui';
var displayOverrideRef = 'hideSeriesFrom';
var isHideSeriesOverride = isSystemOverrideWithRef(displayOverrideRef);
export function seriesVisibilityConfigFactory(label, mode, fieldConfig, data) {
    var overrides = fieldConfig.overrides;
    var displayName = label;
    var currentIndex = overrides.findIndex(isHideSeriesOverride);
    if (currentIndex < 0) {
        if (mode === SeriesVisibilityChangeMode.ToggleSelection) {
            var override_1 = createOverride([displayName]);
            return __assign(__assign({}, fieldConfig), { overrides: __spreadArray(__spreadArray([], __read(fieldConfig.overrides), false), [override_1], false) });
        }
        var displayNames = getDisplayNames(data, displayName);
        var override_2 = createOverride(displayNames);
        return __assign(__assign({}, fieldConfig), { overrides: __spreadArray(__spreadArray([], __read(fieldConfig.overrides), false), [override_2], false) });
    }
    var overridesCopy = Array.from(overrides);
    var _a = __read(overridesCopy.splice(currentIndex, 1), 1), current = _a[0];
    if (mode === SeriesVisibilityChangeMode.ToggleSelection) {
        var existing = getExistingDisplayNames(current);
        if (existing[0] === displayName && existing.length === 1) {
            return __assign(__assign({}, fieldConfig), { overrides: overridesCopy });
        }
        var override_3 = createOverride([displayName]);
        return __assign(__assign({}, fieldConfig), { overrides: __spreadArray(__spreadArray([], __read(overridesCopy), false), [override_3], false) });
    }
    var override = createExtendedOverride(current, displayName);
    if (allFieldsAreExcluded(override, data)) {
        return __assign(__assign({}, fieldConfig), { overrides: overridesCopy });
    }
    return __assign(__assign({}, fieldConfig), { overrides: __spreadArray(__spreadArray([], __read(overridesCopy), false), [override], false) });
}
function createOverride(names, mode, property) {
    if (mode === void 0) { mode = ByNamesMatcherMode.exclude; }
    property = property !== null && property !== void 0 ? property : {
        id: 'custom.hideFrom',
        value: {
            viz: true,
            legend: false,
            tooltip: false,
        },
    };
    return {
        __systemRef: displayOverrideRef,
        matcher: {
            id: FieldMatcherID.byNames,
            options: {
                mode: mode,
                names: names,
                prefix: mode === ByNamesMatcherMode.exclude ? 'All except:' : undefined,
                readOnly: true,
            },
        },
        properties: [
            __assign(__assign({}, property), { value: {
                    viz: true,
                    legend: false,
                    tooltip: false,
                } }),
        ],
    };
}
var createExtendedOverride = function (current, displayName, mode) {
    if (mode === void 0) { mode = ByNamesMatcherMode.exclude; }
    var property = current.properties.find(function (p) { return p.id === 'custom.hideFrom'; });
    var existing = getExistingDisplayNames(current);
    var index = existing.findIndex(function (name) { return name === displayName; });
    if (index < 0) {
        existing.push(displayName);
    }
    else {
        existing.splice(index, 1);
    }
    return createOverride(existing, mode, property);
};
var getExistingDisplayNames = function (rule) {
    var _a;
    var names = (_a = rule.matcher.options) === null || _a === void 0 ? void 0 : _a.names;
    if (!Array.isArray(names)) {
        return [];
    }
    return names;
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
//# sourceMappingURL=SeriesVisibilityConfigFactory.js.map