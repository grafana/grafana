import { __values } from "tslib";
import React from 'react';
import { DataTransformerID, standardTransformers, } from '@grafana/data';
import { Select } from '@grafana/ui';
export var LabelsAsFieldsTransformerEditor = function (_a) {
    var e_1, _b, e_2, _c, e_3, _d;
    var input = _a.input, options = _a.options, onChange = _a.onChange;
    var labelNames = [];
    var uniqueLabels = {};
    try {
        for (var input_1 = __values(input), input_1_1 = input_1.next(); !input_1_1.done; input_1_1 = input_1.next()) {
            var frame = input_1_1.value;
            try {
                for (var _e = (e_2 = void 0, __values(frame.fields)), _f = _e.next(); !_f.done; _f = _e.next()) {
                    var field = _f.value;
                    if (!field.labels) {
                        continue;
                    }
                    try {
                        for (var _g = (e_3 = void 0, __values(Object.keys(field.labels))), _h = _g.next(); !_h.done; _h = _g.next()) {
                            var labelName = _h.value;
                            if (!uniqueLabels[labelName]) {
                                labelNames.push({ value: labelName, label: labelName });
                                uniqueLabels[labelName] = true;
                            }
                        }
                    }
                    catch (e_3_1) { e_3 = { error: e_3_1 }; }
                    finally {
                        try {
                            if (_h && !_h.done && (_d = _g.return)) _d.call(_g);
                        }
                        finally { if (e_3) throw e_3.error; }
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_f && !_f.done && (_c = _e.return)) _c.call(_e);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (input_1_1 && !input_1_1.done && (_b = input_1.return)) _b.call(input_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    var onValueLabelChange = function (value) {
        onChange({ valueLabel: value === null || value === void 0 ? void 0 : value.value });
    };
    return (React.createElement("div", { className: "gf-form-inline" },
        React.createElement("div", { className: "gf-form" },
            React.createElement("div", { className: "gf-form-label width-8" }, "Value field name"),
            React.createElement(Select, { menuShouldPortal: true, isClearable: true, allowCustomValue: false, placeholder: "(Optional) Select label", options: labelNames, className: "min-width-18 gf-form-spacing", value: options === null || options === void 0 ? void 0 : options.valueLabel, onChange: onValueLabelChange }))));
};
export var labelsToFieldsTransformerRegistryItem = {
    id: DataTransformerID.labelsToFields,
    editor: LabelsAsFieldsTransformerEditor,
    transformation: standardTransformers.labelsToFieldsTransformer,
    name: 'Labels to fields',
    description: "Groups series by time and return labels or tags as fields.\n                Useful for showing time series with labels in a table where each label key becomes a separate column",
};
//# sourceMappingURL=LabelsToFieldsTransformerEditor.js.map