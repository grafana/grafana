import { __assign, __read, __spreadArray } from "tslib";
import { FieldColorModeId, FieldMatcherID, } from '@grafana/data';
export var changeSeriesColorConfigFactory = function (label, color, fieldConfig) {
    var overrides = fieldConfig.overrides;
    var currentIndex = fieldConfig.overrides.findIndex(function (override) {
        return override.matcher.id === FieldMatcherID.byName && override.matcher.options === label;
    });
    if (currentIndex < 0) {
        return __assign(__assign({}, fieldConfig), { overrides: __spreadArray(__spreadArray([], __read(fieldConfig.overrides), false), [createOverride(label, color)], false) });
    }
    var overridesCopy = Array.from(overrides);
    var existing = overridesCopy[currentIndex];
    var propertyIndex = existing.properties.findIndex(function (p) { return p.id === 'color'; });
    if (propertyIndex < 0) {
        overridesCopy[currentIndex] = __assign(__assign({}, existing), { properties: __spreadArray(__spreadArray([], __read(existing.properties), false), [createProperty(color)], false) });
        return __assign(__assign({}, fieldConfig), { overrides: overridesCopy });
    }
    var propertiesCopy = Array.from(existing.properties);
    propertiesCopy[propertyIndex] = createProperty(color);
    overridesCopy[currentIndex] = __assign(__assign({}, existing), { properties: propertiesCopy });
    return __assign(__assign({}, fieldConfig), { overrides: overridesCopy });
};
var createOverride = function (label, color) {
    return {
        matcher: {
            id: FieldMatcherID.byName,
            options: label,
        },
        properties: [createProperty(color)],
    };
};
var createProperty = function (color) {
    return {
        id: 'color',
        value: {
            mode: FieldColorModeId.Fixed,
            fixedColor: color,
        },
    };
};
//# sourceMappingURL=colorSeriesConfigFactory.js.map