import { __values } from "tslib";
import React, { useMemo } from 'react';
import { FieldType, getFieldDisplayName } from '@grafana/data';
import { Select } from '@grafana/ui';
export var FillBellowToEditor = function (_a) {
    var value = _a.value, context = _a.context, onChange = _a.onChange;
    var names = useMemo(function () {
        var e_1, _a, e_2, _b;
        var names = [];
        if (context.data.length) {
            try {
                for (var _c = __values(context.data), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var frame = _d.value;
                    try {
                        for (var _e = (e_2 = void 0, __values(frame.fields)), _f = _e.next(); !_f.done; _f = _e.next()) {
                            var field = _f.value;
                            if (field.type === FieldType.number) {
                                var label = getFieldDisplayName(field, frame, context.data);
                                names.push({
                                    label: label,
                                    value: label,
                                });
                            }
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        return names;
    }, [context]);
    var current = useMemo(function () {
        var found = names.find(function (v) { return v.value === value; });
        if (found) {
            return found;
        }
        if (value) {
            return {
                label: value,
                value: value,
            };
        }
        return undefined;
    }, [names, value]);
    return (React.createElement(Select, { menuShouldPortal: true, options: names, value: current, onChange: function (v) {
            onChange(v.value);
        } }));
};
//# sourceMappingURL=FillBelowToEditor.js.map