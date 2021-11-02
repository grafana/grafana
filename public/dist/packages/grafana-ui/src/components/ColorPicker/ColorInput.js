import { __assign, __extends, __makeTemplateObject } from "tslib";
import React from 'react';
import tinycolor from 'tinycolor2';
import { debounce } from 'lodash';
import { Input } from '../Input/Input';
import { useStyles2 } from '../../themes';
import { cx, css } from '@emotion/css';
var ColorInput = /** @class */ (function (_super) {
    __extends(ColorInput, _super);
    function ColorInput(props) {
        var _this = _super.call(this, props) || this;
        _this.updateColor = function (color) {
            _this.props.onChange(color);
        };
        _this.onChange = function (event) {
            var newColor = tinycolor(event.currentTarget.value);
            _this.setState({
                value: event.currentTarget.value,
            });
            if (newColor.isValid()) {
                _this.updateColor(newColor.toString());
            }
        };
        _this.onBlur = function () {
            var newColor = tinycolor(_this.state.value);
            if (!newColor.isValid()) {
                _this.setState({
                    value: _this.props.color,
                });
            }
        };
        _this.state = {
            previousColor: props.color,
            value: props.color,
        };
        _this.updateColor = debounce(_this.updateColor, 100);
        return _this;
    }
    ColorInput.getDerivedStateFromProps = function (props, state) {
        var newColor = tinycolor(props.color);
        if (newColor.isValid() && props.color !== state.previousColor) {
            return __assign(__assign({}, state), { previousColor: props.color, value: newColor.toString() });
        }
        return state;
    };
    ColorInput.prototype.render = function () {
        var value = this.state.value;
        return (React.createElement(Input, { className: this.props.className, value: value, onChange: this.onChange, onBlur: this.onBlur, addonBefore: React.createElement(ColorPreview, { color: this.props.color }) }));
    };
    return ColorInput;
}(React.PureComponent));
export default ColorInput;
var ColorPreview = function (_a) {
    var color = _a.color;
    var styles = useStyles2(getColorPreviewStyles);
    return (React.createElement("div", { className: cx(styles, css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n          background-color: ", ";\n        "], ["\n          background-color: ", ";\n        "])), color)) }));
};
var getColorPreviewStyles = function (theme) { return css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n  height: 100%;\n  width: ", "px;\n  border-radius: ", " 0 0 ", ";\n  border: 1px solid ", ";\n"], ["\n  height: 100%;\n  width: ", "px;\n  border-radius: ", " 0 0 ", ";\n  border: 1px solid ", ";\n"])), theme.spacing.gridSize * 4, theme.shape.borderRadius(), theme.shape.borderRadius(), theme.colors.border.medium); };
var templateObject_1, templateObject_2;
//# sourceMappingURL=ColorInput.js.map