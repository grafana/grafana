import React, { useMemo } from 'react';
import { PluginState, TransformerCategory, } from '@grafana/data';
import { Alert, HorizontalGroup, InlineField, InlineFieldRow, Select, ValuePicker } from '@grafana/ui';
import { getDistinctLabels } from '../utils';
import { joinByLabelsTransformer } from './joinByLabels';
export function JoinByLabelsTransformerEditor({ input, options, onChange }) {
    var _a;
    const info = useMemo(() => {
        var _a;
        let warn = undefined;
        const distinct = getDistinctLabels(input);
        const valueOptions = Array.from(distinct).map((value) => ({ label: value, value }));
        let valueOption = valueOptions.find((v) => v.value === options.value);
        if (!valueOption && options.value) {
            valueOption = { label: `${options.value} (not found)`, value: options.value };
            valueOptions.push(valueOption);
        }
        if (!input.length) {
            warn = React.createElement(Alert, { title: "No input found" }, "No input (or labels) found");
        }
        else if (distinct.size === 0) {
            warn = React.createElement(Alert, { title: "No labels found" }, "The input does not contain any labels");
        }
        // Show the selected values
        distinct.delete(options.value);
        const joinOptions = Array.from(distinct).map((value) => ({ label: value, value }));
        let addOptions = joinOptions;
        const hasJoin = Boolean((_a = options.join) === null || _a === void 0 ? void 0 : _a.length);
        let addText = 'Join';
        if (hasJoin) {
            addOptions = joinOptions.filter((v) => !options.join.includes(v.value));
        }
        else {
            addText = joinOptions.map((v) => v.value).join(', '); // all the fields
        }
        return { warn, valueOptions, valueOption, joinOptions, addOptions, addText, hasJoin, key: Date.now() };
    }, [options, input]);
    const updateJoinValue = (idx, value) => {
        if (!options.join) {
            return; // nothing to do
        }
        const join = options.join.slice();
        if (!value) {
            join.splice(idx, 1);
            if (!join.length) {
                onChange(Object.assign(Object.assign({}, options), { join: undefined }));
                return;
            }
        }
        else {
            join[idx] = value;
        }
        // Remove duplicates and the value field
        const t = new Set(join);
        if (options.value) {
            t.delete(options.value);
        }
        onChange(Object.assign(Object.assign({}, options), { join: Array.from(t) }));
    };
    const addJoin = (sel) => {
        const v = sel === null || sel === void 0 ? void 0 : sel.value;
        if (!v) {
            return;
        }
        const join = options.join ? options.join.slice() : [];
        join.push(v);
        onChange(Object.assign(Object.assign({}, options), { join }));
    };
    const labelWidth = 10;
    const noOptionsMessage = 'No labels found';
    return (React.createElement("div", null,
        info.warn,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { error: "required", invalid: !Boolean((_a = options.value) === null || _a === void 0 ? void 0 : _a.length), label: 'Value', labelWidth: labelWidth, tooltip: "Select the label indicating the values name" },
                React.createElement(Select, { options: info.valueOptions, value: info.valueOption, onChange: (v) => onChange(Object.assign(Object.assign({}, options), { value: v.value })), noOptionsMessage: noOptionsMessage }))),
        info.hasJoin ? (options.join.map((v, idx) => (React.createElement(InlineFieldRow, { key: v + idx },
            React.createElement(InlineField, { label: 'Join', labelWidth: labelWidth, error: "Unable to join by the value label", invalid: v === options.value },
                React.createElement(HorizontalGroup, null,
                    React.createElement(Select, { options: info.joinOptions, value: info.joinOptions.find((o) => o.value === v), isClearable: true, onChange: (v) => updateJoinValue(idx, v === null || v === void 0 ? void 0 : v.value), noOptionsMessage: noOptionsMessage }),
                    Boolean(info.addOptions.length && idx === options.join.length - 1) && (React.createElement(ValuePicker, { icon: "plus", label: '', options: info.addOptions, onChange: addJoin, variant: "secondary" })))))))) : (React.createElement(React.Fragment, null, Boolean(info.addOptions.length) && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: 'Join', labelWidth: labelWidth },
                React.createElement(Select, { options: info.addOptions, placeholder: info.addText, onChange: addJoin, noOptionsMessage: noOptionsMessage }))))))));
}
export const joinByLabelsTransformRegistryItem = {
    id: joinByLabelsTransformer.id,
    editor: JoinByLabelsTransformerEditor,
    transformation: joinByLabelsTransformer,
    name: joinByLabelsTransformer.name,
    description: joinByLabelsTransformer.description,
    state: PluginState.beta,
    categories: new Set([TransformerCategory.Combine]),
    //   help: `
    // ### Use cases
    // This transforms labeled results into a table
    // `,
};
//# sourceMappingURL=JoinByLabelsTransformerEditor.js.map