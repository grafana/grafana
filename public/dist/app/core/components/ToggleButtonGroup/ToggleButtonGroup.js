import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { Tooltip } from '@grafana/ui';
var ToggleButtonGroup = /** @class */ (function (_super) {
    tslib_1.__extends(ToggleButtonGroup, _super);
    function ToggleButtonGroup() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ToggleButtonGroup.prototype.render = function () {
        var _a = this.props, children = _a.children, label = _a.label, transparent = _a.transparent;
        return (React.createElement("div", { className: "gf-form" },
            label && React.createElement("label", { className: "gf-form-label " + (transparent ? 'gf-form-label--transparent' : '') }, label),
            React.createElement("div", { className: "toggle-button-group " + (transparent ? 'toggle-button-group--transparent' : '') }, children)));
    };
    return ToggleButtonGroup;
}(PureComponent));
export default ToggleButtonGroup;
export var ToggleButton = function (_a) {
    var children = _a.children, selected = _a.selected, _b = _a.className, className = _b === void 0 ? '' : _b, _c = _a.value, value = _c === void 0 ? null : _c, tooltip = _a.tooltip, onChange = _a.onChange;
    var onClick = function (event) {
        event.stopPropagation();
        if (onChange) {
            onChange(value);
        }
    };
    var btnClassName = "btn " + className + " " + (selected ? 'active' : '');
    var button = (React.createElement("button", { className: btnClassName, onClick: onClick },
        React.createElement("span", null, children)));
    if (tooltip) {
        return (React.createElement(Tooltip, { content: tooltip, placement: "bottom" }, button));
    }
    else {
        return button;
    }
};
//# sourceMappingURL=ToggleButtonGroup.js.map