import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { Input } from '@grafana/ui';
/**
 * This is an Input field that will call `onChange` for blur and enter
 */
var NumberInput = /** @class */ (function (_super) {
    __extends(NumberInput, _super);
    function NumberInput() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = { text: '' };
        _this.onBlur = function (e) {
            var value = undefined;
            var txt = e.currentTarget.value;
            if (txt && !isNaN(e.currentTarget.valueAsNumber)) {
                value = e.currentTarget.valueAsNumber;
            }
            _this.props.onChange(value);
        };
        _this.onChange = function (e) {
            _this.setState({
                text: e.currentTarget.value,
            });
        };
        _this.onKeyPress = function (e) {
            if (e.key === 'Enter') {
                _this.onBlur(e);
            }
        };
        return _this;
    }
    NumberInput.prototype.componentDidMount = function () {
        this.setState({
            text: isNaN(this.props.value) ? '' : "" + this.props.value,
        });
    };
    NumberInput.prototype.componentDidUpdate = function (oldProps) {
        if (this.props.value !== oldProps.value) {
            this.setState({
                text: isNaN(this.props.value) ? '' : "" + this.props.value,
            });
        }
    };
    NumberInput.prototype.render = function () {
        var placeholder = this.props.placeholder;
        var text = this.state.text;
        return (React.createElement(Input, { type: "number", min: this.props.min, max: this.props.max, step: this.props.step, autoFocus: this.props.autoFocus, value: text, onChange: this.onChange, onBlur: this.onBlur, onKeyPress: this.onKeyPress, placeholder: placeholder }));
    };
    return NumberInput;
}(PureComponent));
export { NumberInput };
//# sourceMappingURL=NumberInput.js.map