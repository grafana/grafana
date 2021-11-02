import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { VerticalGroup } from '@grafana/ui';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableTextField } from '../editor/VariableTextField';
var ConstantVariableEditor = /** @class */ (function (_super) {
    __extends(ConstantVariableEditor, _super);
    function ConstantVariableEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onChange = function (event) {
            _this.props.onPropChange({
                propName: 'query',
                propValue: event.currentTarget.value,
            });
        };
        _this.onBlur = function (event) {
            _this.props.onPropChange({
                propName: 'query',
                propValue: event.currentTarget.value,
                updateOptions: true,
            });
        };
        return _this;
    }
    ConstantVariableEditor.prototype.render = function () {
        return (React.createElement(VerticalGroup, { spacing: "xs" },
            React.createElement(VariableSectionHeader, { name: "Constant options" }),
            React.createElement(VariableTextField, { value: this.props.variable.query, name: "Value", placeholder: "your metric prefix", onChange: this.onChange, onBlur: this.onBlur, labelWidth: 20, ariaLabel: selectors.pages.Dashboard.Settings.Variables.Edit.ConstantVariable.constantOptionsQueryInput, grow: true })));
    };
    return ConstantVariableEditor;
}(PureComponent));
export { ConstantVariableEditor };
//# sourceMappingURL=ConstantVariableEditor.js.map