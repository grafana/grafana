import { __assign } from "tslib";
import React from 'react';
import { PluginState } from '@grafana/data';
import { rowsToFieldsTransformer } from './rowsToFields';
import { FieldToConfigMappingEditor } from '../fieldToConfigMapping/FieldToConfigMappingEditor';
export function RowsToFieldsTransformerEditor(_a) {
    var _b;
    var input = _a.input, options = _a.options, onChange = _a.onChange;
    if (input.length === 0) {
        return null;
    }
    return (React.createElement("div", null,
        React.createElement(FieldToConfigMappingEditor, { frame: input[0], mappings: (_b = options.mappings) !== null && _b !== void 0 ? _b : [], onChange: function (mappings) { return onChange(__assign(__assign({}, options), { mappings: mappings })); }, withNameAndValue: true })));
}
export var rowsToFieldsTransformRegistryItem = {
    id: rowsToFieldsTransformer.id,
    editor: RowsToFieldsTransformerEditor,
    transformation: rowsToFieldsTransformer,
    name: rowsToFieldsTransformer.name,
    description: rowsToFieldsTransformer.description,
    state: PluginState.beta,
    help: "\n### Use cases \n\nThis transforms rows into separate fields. This can be useful as fields can be styled and configured \nindividually, something rows cannot. It can also use additional fields as sources for dynamic field \nconfiguration or map them to field labels. The additional labels can then be used to define better \ndisplay names for the resulting fields.\n\nUseful when visualization data in:\n- Gauge\n- Stat\n- Pie chart\n\n## Example\n\nInput:\n\n| Name    | Value | Max |\n| ------- | ----- | --- |\n| ServerA | 10    | 100 |\n| ServerB | 20    | 200 |\n| ServerC | 30    | 300 |\n\nOutput:\n\n| ServerA (config: max=100) | ServerB (config: max=200) | ServerC (config: max=300) |\n| ------------------------- | ------------------------- | ------------------------- |\n| 10                        | 20                        | 30                        |\n\nAs you can see each row in the source data becomes a separate field. Each field now also has a max \nconfig option set. Options like **Min**, **Max**, **Unit** and **Thresholds** are all part of field \nconfiguration and if set like this will be used by the visualization instead of any options manually \nconfigured in the panel editor options pane.\n\n",
};
//# sourceMappingURL=RowsToFieldsTransformerEditor.js.map