import { ByNamesMatcherMode, FieldMatcherID, fieldMatchers, FieldType, getFieldDisplayName, isSystemOverrideWithRef, } from '@grafana/data';
import { SeriesVisibilityChangeMode } from '@grafana/ui';
const displayOverrideRef = 'hideSeriesFrom';
const isHideSeriesOverride = isSystemOverrideWithRef(displayOverrideRef);
export function seriesVisibilityConfigFactory(label, mode, fieldConfig, data) {
    const { overrides } = fieldConfig;
    const displayName = label;
    const currentIndex = overrides.findIndex(isHideSeriesOverride);
    if (currentIndex < 0) {
        if (mode === SeriesVisibilityChangeMode.ToggleSelection) {
            const override = createOverride([displayName, ...getNamesOfHiddenFields(overrides, data)]);
            return Object.assign(Object.assign({}, fieldConfig), { overrides: [...fieldConfig.overrides, override] });
        }
        const displayNames = getDisplayNames(data, displayName);
        const override = createOverride(displayNames);
        return Object.assign(Object.assign({}, fieldConfig), { overrides: [...fieldConfig.overrides, override] });
    }
    const overridesCopy = Array.from(overrides);
    const [current] = overridesCopy.splice(currentIndex, 1);
    if (mode === SeriesVisibilityChangeMode.ToggleSelection) {
        let existing = getExistingDisplayNames(current);
        const nameOfHiddenFields = getNamesOfHiddenFields(overridesCopy, data);
        if (nameOfHiddenFields.length > 0) {
            existing = existing.filter((el) => nameOfHiddenFields.indexOf(el) < 0);
        }
        if (existing[0] === displayName && existing.length === 1) {
            return Object.assign(Object.assign({}, fieldConfig), { overrides: overridesCopy });
        }
        const override = createOverride([displayName, ...nameOfHiddenFields]);
        return Object.assign(Object.assign({}, fieldConfig), { overrides: [...overridesCopy, override] });
    }
    const override = createExtendedOverride(current, displayName);
    if (allFieldsAreExcluded(override, data)) {
        return Object.assign(Object.assign({}, fieldConfig), { overrides: overridesCopy });
    }
    return Object.assign(Object.assign({}, fieldConfig), { overrides: [...overridesCopy, override] });
}
function createOverride(names, mode = ByNamesMatcherMode.exclude, property) {
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
            Object.assign(Object.assign({}, property), { value: {
                    viz: true,
                    legend: false,
                    tooltip: false,
                } }),
        ],
    };
}
const createExtendedOverride = (current, displayName, mode = ByNamesMatcherMode.exclude) => {
    const property = current.properties.find((p) => p.id === 'custom.hideFrom');
    const existing = getExistingDisplayNames(current);
    const index = existing.findIndex((name) => name === displayName);
    if (index < 0) {
        existing.push(displayName);
    }
    else {
        existing.splice(index, 1);
    }
    return createOverride(existing, mode, property);
};
const getExistingDisplayNames = (rule) => {
    var _a;
    const names = (_a = rule.matcher.options) === null || _a === void 0 ? void 0 : _a.names;
    if (!Array.isArray(names)) {
        return [];
    }
    return [...names];
};
const allFieldsAreExcluded = (override, data) => {
    return getExistingDisplayNames(override).length === getDisplayNames(data).length;
};
const getDisplayNames = (data, excludeName) => {
    const unique = new Set();
    for (const frame of data) {
        for (const field of frame.fields) {
            if (field.type !== FieldType.number) {
                continue;
            }
            const name = getFieldDisplayName(field, frame, data);
            if (name === excludeName) {
                continue;
            }
            unique.add(name);
        }
    }
    return Array.from(unique);
};
const getNamesOfHiddenFields = (overrides, data) => {
    var _a;
    let names = [];
    for (const override of overrides) {
        const property = override.properties.find((p) => p.id === 'custom.hideFrom');
        if (property !== undefined && ((_a = property.value) === null || _a === void 0 ? void 0 : _a.legend) === true) {
            const info = fieldMatchers.get(override.matcher.id);
            const matcher = info.get(override.matcher.options);
            for (const frame of data) {
                for (const field of frame.fields) {
                    if (field.type !== FieldType.number) {
                        continue;
                    }
                    const name = getFieldDisplayName(field, frame, data);
                    if (matcher(field, frame, data)) {
                        names.push(name);
                    }
                }
            }
        }
    }
    return names;
};
//# sourceMappingURL=SeriesVisibilityConfigFactory.js.map