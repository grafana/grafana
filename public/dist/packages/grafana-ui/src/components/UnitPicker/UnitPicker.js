import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { Cascader } from '../Cascader/Cascader';
import { getValueFormats } from '@grafana/data';
function formatCreateLabel(input) {
    return "Custom unit: " + input;
}
var UnitPicker = /** @class */ (function (_super) {
    __extends(UnitPicker, _super);
    function UnitPicker() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onChange = function (value) {
            _this.props.onChange(value.value);
        };
        return _this;
    }
    UnitPicker.prototype.render = function () {
        var _a = this.props, value = _a.value, width = _a.width;
        // Set the current selection
        var current = undefined;
        // All units
        var unitGroups = getValueFormats();
        // Need to transform the data structure to work well with Select
        var groupOptions = unitGroups.map(function (group) {
            var options = group.submenu.map(function (unit) {
                var sel = {
                    label: unit.text,
                    value: unit.value,
                };
                if (unit.value === value) {
                    current = sel;
                }
                return sel;
            });
            return {
                label: group.text,
                value: group.text,
                items: options,
            };
        });
        // Show the custom unit
        if (value && !current) {
            current = { value: value, label: value };
        }
        return (React.createElement(Cascader, { width: width, initialValue: current && current.label, allowCustomValue: true, changeOnSelect: false, formatCreateLabel: formatCreateLabel, options: groupOptions, placeholder: "Choose", onSelect: this.props.onChange }));
    };
    return UnitPicker;
}(PureComponent));
export { UnitPicker };
//# sourceMappingURL=UnitPicker.js.map