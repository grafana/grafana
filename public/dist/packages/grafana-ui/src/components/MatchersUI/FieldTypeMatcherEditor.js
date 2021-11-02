import { __assign, __values } from "tslib";
import React, { memo, useMemo, useCallback } from 'react';
import { FieldMatcherID, fieldMatchers, FieldType } from '@grafana/data';
import { Select } from '../Select/Select';
export var FieldTypeMatcherEditor = memo(function (props) {
    var data = props.data, options = props.options, onChangeFromProps = props.onChange;
    var counts = useFieldCounts(data);
    var selectOptions = useSelectOptions(counts, options);
    var onChange = useCallback(function (selection) {
        return onChangeFromProps(selection.value);
    }, [onChangeFromProps]);
    var selectedOption = selectOptions.find(function (v) { return v.value === options; });
    return React.createElement(Select, { menuShouldPortal: true, value: selectedOption, options: selectOptions, onChange: onChange });
});
FieldTypeMatcherEditor.displayName = 'FieldTypeMatcherEditor';
var allTypes = [
    { value: FieldType.number, label: 'Numeric' },
    { value: FieldType.string, label: 'String' },
    { value: FieldType.time, label: 'Time' },
    { value: FieldType.boolean, label: 'Boolean' },
    { value: FieldType.trace, label: 'Traces' },
    { value: FieldType.other, label: 'Other' },
];
var useFieldCounts = function (data) {
    return useMemo(function () {
        var e_1, _a, e_2, _b, e_3, _c;
        var counts = new Map();
        try {
            for (var allTypes_1 = __values(allTypes), allTypes_1_1 = allTypes_1.next(); !allTypes_1_1.done; allTypes_1_1 = allTypes_1.next()) {
                var t = allTypes_1_1.value;
                counts.set(t.value, 0);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (allTypes_1_1 && !allTypes_1_1.done && (_a = allTypes_1.return)) _a.call(allTypes_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        try {
            for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
                var frame = data_1_1.value;
                try {
                    for (var _d = (e_3 = void 0, __values(frame.fields)), _e = _d.next(); !_e.done; _e = _d.next()) {
                        var field = _e.value;
                        var key = field.type || FieldType.other;
                        var v = counts.get(key);
                        if (!v) {
                            v = 0;
                        }
                        counts.set(key, v + 1);
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (_e && !_e.done && (_c = _d.return)) _c.call(_d);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (data_1_1 && !data_1_1.done && (_b = data_1.return)) _b.call(data_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return counts;
    }, [data]);
};
var useSelectOptions = function (counts, opt) {
    return useMemo(function () {
        var e_4, _a;
        var found = false;
        var options = [];
        try {
            for (var allTypes_2 = __values(allTypes), allTypes_2_1 = allTypes_2.next(); !allTypes_2_1.done; allTypes_2_1 = allTypes_2.next()) {
                var t = allTypes_2_1.value;
                var count = counts.get(t.value);
                var match = opt === t.value;
                if (count || match) {
                    options.push(__assign(__assign({}, t), { label: t.label + " (" + counts.get(t.value) + ")" }));
                }
                if (match) {
                    found = true;
                }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (allTypes_2_1 && !allTypes_2_1.done && (_a = allTypes_2.return)) _a.call(allTypes_2);
            }
            finally { if (e_4) throw e_4.error; }
        }
        if (opt && !found) {
            options.push({
                value: opt,
                label: opt + " (No matches)",
            });
        }
        return options;
    }, [counts, opt]);
};
export var fieldTypeMatcherItem = {
    id: FieldMatcherID.byType,
    component: FieldTypeMatcherEditor,
    matcher: fieldMatchers.get(FieldMatcherID.byType),
    name: 'Fields with type',
    description: 'Set properties for fields of a specific type (number, string, boolean)',
    optionsToLabel: function (options) { return options; },
};
//# sourceMappingURL=FieldTypeMatcherEditor.js.map