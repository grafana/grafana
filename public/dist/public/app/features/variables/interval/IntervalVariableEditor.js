import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { InlineFieldRow, VerticalGroup } from '@grafana/ui';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableTextField } from '../editor/VariableTextField';
import { VariableSwitchField } from '../editor/VariableSwitchField';
import { VariableSelectField } from '../editor/VariableSelectField';
var IntervalVariableEditor = /** @class */ (function (_super) {
    __extends(IntervalVariableEditor, _super);
    function IntervalVariableEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onAutoChange = function (event) {
            _this.props.onPropChange({
                propName: 'auto',
                propValue: event.target.checked,
                updateOptions: true,
            });
        };
        _this.onQueryChanged = function (event) {
            _this.props.onPropChange({
                propName: 'query',
                propValue: event.currentTarget.value,
            });
        };
        _this.onQueryBlur = function (event) {
            _this.props.onPropChange({
                propName: 'query',
                propValue: event.currentTarget.value,
                updateOptions: true,
            });
        };
        _this.onAutoCountChanged = function (option) {
            _this.props.onPropChange({
                propName: 'auto_count',
                propValue: option.value,
                updateOptions: true,
            });
        };
        _this.onAutoMinChanged = function (event) {
            _this.props.onPropChange({
                propName: 'auto_min',
                propValue: event.currentTarget.value,
                updateOptions: true,
            });
        };
        return _this;
    }
    IntervalVariableEditor.prototype.render = function () {
        var _a;
        var variable = this.props.variable;
        var stepOptions = [1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 100, 200, 300, 400, 500].map(function (count) { return ({
            label: "" + count,
            value: count,
        }); });
        var stepValue = (_a = stepOptions.find(function (o) { return o.value === variable.auto_count; })) !== null && _a !== void 0 ? _a : stepOptions[0];
        return (React.createElement(VerticalGroup, { spacing: "xs" },
            React.createElement(VariableSectionHeader, { name: "Interval options" }),
            React.createElement(VerticalGroup, { spacing: "none" },
                React.createElement(VariableTextField, { value: this.props.variable.query, name: "Values", placeholder: "1m,10m,1h,6h,1d,7d", onChange: this.onQueryChanged, onBlur: this.onQueryBlur, labelWidth: 20, grow: true, required: true }),
                React.createElement(InlineFieldRow, null,
                    React.createElement(VariableSwitchField, { value: this.props.variable.auto, name: "Auto option", tooltip: "Dynamically calculates interval by dividing time range by the count specified.", onChange: this.onAutoChange }),
                    this.props.variable.auto ? (React.createElement(React.Fragment, null,
                        React.createElement(VariableSelectField, { name: "Step count", value: stepValue, options: stepOptions, onChange: this.onAutoCountChanged, tooltip: "How many times the current time range should be divided to calculate the value.", labelWidth: 7, width: 9 }),
                        React.createElement(VariableTextField, { value: this.props.variable.auto_min, name: "Min interval", placeholder: "10s", onChange: this.onAutoMinChanged, tooltip: "The calculated value will not go below this threshold.", labelWidth: 13, width: 11 }))) : null))));
    };
    return IntervalVariableEditor;
}(PureComponent));
export { IntervalVariableEditor };
//# sourceMappingURL=IntervalVariableEditor.js.map