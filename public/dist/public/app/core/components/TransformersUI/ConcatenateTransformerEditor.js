import { __assign, __extends } from "tslib";
import React from 'react';
import { DataTransformerID, standardTransformers, } from '@grafana/data';
import { Input, Select } from '@grafana/ui';
import { ConcatenateFrameNameMode, } from '@grafana/data/src/transformations/transformers/concat';
var nameModes = [
    { value: ConcatenateFrameNameMode.FieldName, label: 'Copy frame name to field name' },
    { value: ConcatenateFrameNameMode.Label, label: 'Add a label with the frame name' },
    { value: ConcatenateFrameNameMode.Drop, label: 'Ignore the frame name' },
];
var ConcatenateTransformerEditor = /** @class */ (function (_super) {
    __extends(ConcatenateTransformerEditor, _super);
    function ConcatenateTransformerEditor(props) {
        var _this = _super.call(this, props) || this;
        _this.onModeChanged = function (value) {
            var _a;
            var _b = _this.props, options = _b.options, onChange = _b.onChange;
            var frameNameMode = (_a = value.value) !== null && _a !== void 0 ? _a : ConcatenateFrameNameMode.FieldName;
            onChange(__assign(__assign({}, options), { frameNameMode: frameNameMode }));
        };
        _this.onLabelChanged = function (evt) {
            var options = _this.props.options;
            _this.props.onChange(__assign(__assign({}, options), { frameNameLabel: evt.target.value }));
        };
        return _this;
    }
    //---------------------------------------------------------
    // Render
    //---------------------------------------------------------
    ConcatenateTransformerEditor.prototype.render = function () {
        var _a, _b;
        var options = this.props.options;
        var frameNameMode = (_a = options.frameNameMode) !== null && _a !== void 0 ? _a : ConcatenateFrameNameMode.FieldName;
        return (React.createElement("div", null,
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("div", { className: "gf-form-label width-8" }, "Name"),
                    React.createElement(Select, { menuShouldPortal: true, className: "width-18", options: nameModes, value: nameModes.find(function (v) { return v.value === frameNameMode; }), onChange: this.onModeChanged }))),
            frameNameMode === ConcatenateFrameNameMode.Label && (React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("div", { className: "gf-form-label width-8" }, "Label"),
                    React.createElement(Input, { className: "width-18", value: (_b = options.frameNameLabel) !== null && _b !== void 0 ? _b : '', placeholder: "frame", onChange: this.onLabelChanged }))))));
    };
    return ConcatenateTransformerEditor;
}(React.PureComponent));
export { ConcatenateTransformerEditor };
export var concatenateTransformRegistryItem = {
    id: DataTransformerID.concatenate,
    editor: ConcatenateTransformerEditor,
    transformation: standardTransformers.concatenateTransformer,
    name: 'Concatenate fields',
    description: 'Combine all fields into a single frame.  Values will be appended with undefined values if not the same length.',
};
//# sourceMappingURL=ConcatenateTransformerEditor.js.map