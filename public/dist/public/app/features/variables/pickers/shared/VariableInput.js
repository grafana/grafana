import { __assign, __extends, __rest } from "tslib";
import React, { PureComponent } from 'react';
import { NavigationKey } from '../types';
var VariableInput = /** @class */ (function (_super) {
    __extends(VariableInput, _super);
    function VariableInput() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onKeyDown = function (event) {
            if (NavigationKey[event.keyCode]) {
                var clearOthers = event.ctrlKey || event.metaKey || event.shiftKey;
                _this.props.onNavigate(event.keyCode, clearOthers);
                event.preventDefault();
            }
        };
        _this.onChange = function (event) {
            _this.props.onChange(event.target.value);
        };
        return _this;
    }
    VariableInput.prototype.render = function () {
        var _a = this.props, value = _a.value, id = _a.id, onNavigate = _a.onNavigate, restProps = __rest(_a, ["value", "id", "onNavigate"]);
        return (React.createElement("input", __assign({}, restProps, { ref: function (instance) {
                if (instance) {
                    instance.focus();
                    instance.setAttribute('style', "width:" + Math.max(instance.width, 150) + "px");
                }
            }, type: "text", className: "gf-form-input", value: value !== null && value !== void 0 ? value : '', onChange: this.onChange, onKeyDown: this.onKeyDown, placeholder: "Enter variable value" })));
    };
    return VariableInput;
}(PureComponent));
export { VariableInput };
//# sourceMappingURL=VariableInput.js.map