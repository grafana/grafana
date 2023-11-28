import React from 'react';
import { DataTransformerID, standardTransformers, TransformerCategory, } from '@grafana/data';
import { ConcatenateFrameNameMode, } from '@grafana/data/src/transformations/transformers/concat';
import { Input, Select } from '@grafana/ui';
const nameModes = [
    { value: ConcatenateFrameNameMode.FieldName, label: 'Copy frame name to field name' },
    { value: ConcatenateFrameNameMode.Label, label: 'Add a label with the frame name' },
    { value: ConcatenateFrameNameMode.Drop, label: 'Ignore the frame name' },
];
export class ConcatenateTransformerEditor extends React.PureComponent {
    constructor(props) {
        super(props);
        this.onModeChanged = (value) => {
            var _a;
            const { options, onChange } = this.props;
            const frameNameMode = (_a = value.value) !== null && _a !== void 0 ? _a : ConcatenateFrameNameMode.FieldName;
            onChange(Object.assign(Object.assign({}, options), { frameNameMode }));
        };
        this.onLabelChanged = (evt) => {
            const { options } = this.props;
            this.props.onChange(Object.assign(Object.assign({}, options), { frameNameLabel: evt.target.value }));
        };
    }
    //---------------------------------------------------------
    // Render
    //---------------------------------------------------------
    render() {
        var _a, _b;
        const { options } = this.props;
        const frameNameMode = (_a = options.frameNameMode) !== null && _a !== void 0 ? _a : ConcatenateFrameNameMode.FieldName;
        return (React.createElement("div", null,
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("div", { className: "gf-form-label width-8" }, "Name"),
                    React.createElement(Select, { className: "width-18", options: nameModes, value: nameModes.find((v) => v.value === frameNameMode), onChange: this.onModeChanged }))),
            frameNameMode === ConcatenateFrameNameMode.Label && (React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("div", { className: "gf-form-label width-8" }, "Label"),
                    React.createElement(Input, { className: "width-18", value: (_b = options.frameNameLabel) !== null && _b !== void 0 ? _b : '', placeholder: "frame", onChange: this.onLabelChanged }))))));
    }
}
export const concatenateTransformRegistryItem = {
    id: DataTransformerID.concatenate,
    editor: ConcatenateTransformerEditor,
    transformation: standardTransformers.concatenateTransformer,
    name: 'Concatenate fields',
    description: 'Combine all fields into a single frame.  Values will be appended with undefined values if not the same length.',
    categories: new Set([TransformerCategory.Combine]),
};
//# sourceMappingURL=ConcatenateTransformerEditor.js.map