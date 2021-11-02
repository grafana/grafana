import { __extends } from "tslib";
import React from 'react';
import { ValueMappingsEditor } from '../ValueMappingsEditor/ValueMappingsEditor';
var ValueMappingsValueEditor = /** @class */ (function (_super) {
    __extends(ValueMappingsValueEditor, _super);
    function ValueMappingsValueEditor(props) {
        return _super.call(this, props) || this;
    }
    ValueMappingsValueEditor.prototype.render = function () {
        var onChange = this.props.onChange;
        var value = this.props.value;
        if (!value) {
            value = [];
        }
        return React.createElement(ValueMappingsEditor, { value: value, onChange: onChange });
    };
    return ValueMappingsValueEditor;
}(React.PureComponent));
export { ValueMappingsValueEditor };
//# sourceMappingURL=mappings.js.map