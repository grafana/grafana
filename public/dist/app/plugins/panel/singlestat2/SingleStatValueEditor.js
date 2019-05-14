import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
// Components
import { FormField, FormLabel, PanelOptionsGroup, Select, UnitPicker } from '@grafana/ui';
var statOptions = [
    { value: 'min', label: 'Min' },
    { value: 'max', label: 'Max' },
    { value: 'avg', label: 'Average' },
    { value: 'current', label: 'Current' },
    { value: 'total', label: 'Total' },
    { value: 'name', label: 'Name' },
    { value: 'first', label: 'First' },
    { value: 'delta', label: 'Delta' },
    { value: 'diff', label: 'Difference' },
    { value: 'range', label: 'Range' },
    { value: 'last_time', label: 'Time of last point' },
];
var labelWidth = 6;
var SingleStatValueEditor = /** @class */ (function (_super) {
    tslib_1.__extends(SingleStatValueEditor, _super);
    function SingleStatValueEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onUnitChange = function (unit) { return _this.props.onChange(tslib_1.__assign({}, _this.props.options, { unit: unit.value })); };
        _this.onStatChange = function (stat) { return _this.props.onChange(tslib_1.__assign({}, _this.props.options, { stat: stat.value })); };
        _this.onDecimalChange = function (event) {
            if (!isNaN(event.target.value)) {
                _this.props.onChange(tslib_1.__assign({}, _this.props.options, { decimals: parseInt(event.target.value, 10) }));
            }
            else {
                _this.props.onChange(tslib_1.__assign({}, _this.props.options, { decimals: null }));
            }
        };
        _this.onPrefixChange = function (event) { return _this.props.onChange(tslib_1.__assign({}, _this.props.options, { prefix: event.target.value })); };
        _this.onSuffixChange = function (event) { return _this.props.onChange(tslib_1.__assign({}, _this.props.options, { suffix: event.target.value })); };
        return _this;
    }
    SingleStatValueEditor.prototype.render = function () {
        var _a = this.props.options, stat = _a.stat, unit = _a.unit, decimals = _a.decimals, prefix = _a.prefix, suffix = _a.suffix;
        var decimalsString = '';
        if (Number.isFinite(decimals)) {
            decimalsString = decimals.toString();
        }
        return (React.createElement(PanelOptionsGroup, { title: "Value" },
            React.createElement("div", { className: "gf-form" },
                React.createElement(FormLabel, { width: labelWidth }, "Stat"),
                React.createElement(Select, { width: 12, options: statOptions, onChange: this.onStatChange, value: statOptions.find(function (option) { return option.value === stat; }) })),
            React.createElement("div", { className: "gf-form" },
                React.createElement(FormLabel, { width: labelWidth }, "Unit"),
                React.createElement(UnitPicker, { defaultValue: unit, onChange: this.onUnitChange })),
            React.createElement(FormField, { label: "Decimals", labelWidth: labelWidth, placeholder: "auto", onChange: this.onDecimalChange, value: decimalsString, type: "number" }),
            React.createElement(FormField, { label: "Prefix", labelWidth: labelWidth, onChange: this.onPrefixChange, value: prefix || '' }),
            React.createElement(FormField, { label: "Suffix", labelWidth: labelWidth, onChange: this.onSuffixChange, value: suffix || '' })));
    };
    return SingleStatValueEditor;
}(PureComponent));
export { SingleStatValueEditor };
//# sourceMappingURL=SingleStatValueEditor.js.map