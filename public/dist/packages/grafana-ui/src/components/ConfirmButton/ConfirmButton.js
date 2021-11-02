import { __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { cx, css } from '@emotion/css';
import { stylesFactory, withTheme } from '../../themes';
import { Button } from '../Button';
var UnThemedConfirmButton = /** @class */ (function (_super) {
    __extends(UnThemedConfirmButton, _super);
    function UnThemedConfirmButton() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            showConfirm: false,
        };
        _this.onClickButton = function (event) {
            if (event) {
                event.preventDefault();
            }
            _this.setState({
                showConfirm: true,
            });
            if (_this.props.onClick) {
                _this.props.onClick();
            }
        };
        _this.onClickCancel = function (event) {
            if (event) {
                event.preventDefault();
            }
            _this.setState({
                showConfirm: false,
            });
            if (_this.props.onCancel) {
                _this.props.onCancel();
            }
        };
        _this.onConfirm = function (event) {
            if (event) {
                event.preventDefault();
            }
            _this.props.onConfirm();
            if (_this.props.closeOnConfirm) {
                _this.setState({
                    showConfirm: false,
                });
            }
        };
        return _this;
    }
    UnThemedConfirmButton.prototype.render = function () {
        var _a = this.props, theme = _a.theme, className = _a.className, size = _a.size, disabled = _a.disabled, confirmText = _a.confirmText, confirmButtonVariant = _a.confirmVariant, children = _a.children;
        var styles = getStyles(theme);
        var buttonClass = cx(className, this.state.showConfirm ? styles.buttonHide : styles.buttonShow, disabled && styles.buttonDisabled);
        var confirmButtonClass = cx(styles.confirmButton, this.state.showConfirm ? styles.confirmButtonShow : styles.confirmButtonHide);
        var onClick = disabled ? function () { } : this.onClickButton;
        return (React.createElement("span", { className: styles.buttonContainer },
            typeof children === 'string' ? (React.createElement("span", { className: buttonClass },
                React.createElement(Button, { size: size, fill: "text", onClick: onClick }, children))) : (React.createElement("span", { className: buttonClass, onClick: onClick }, children)),
            React.createElement("span", { className: confirmButtonClass },
                React.createElement(Button, { size: size, fill: "text", onClick: this.onClickCancel }, "Cancel"),
                React.createElement(Button, { size: size, variant: confirmButtonVariant, onClick: this.onConfirm }, confirmText))));
    };
    return UnThemedConfirmButton;
}(PureComponent));
export var ConfirmButton = withTheme(UnThemedConfirmButton);
var getStyles = stylesFactory(function (theme) {
    return {
        buttonContainer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      direction: rtl;\n      display: flex;\n      align-items: center;\n    "], ["\n      direction: rtl;\n      display: flex;\n      align-items: center;\n    "]))),
        buttonDisabled: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      text-decoration: none;\n      color: ", ";\n      opacity: 0.65;\n      cursor: not-allowed;\n      pointer-events: none;\n    "], ["\n      text-decoration: none;\n      color: ", ";\n      opacity: 0.65;\n      cursor: not-allowed;\n      pointer-events: none;\n    "])), theme.colors.text),
        buttonShow: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      opacity: 1;\n      transition: opacity 0.1s ease;\n      z-index: 2;\n    "], ["\n      opacity: 1;\n      transition: opacity 0.1s ease;\n      z-index: 2;\n    "]))),
        buttonHide: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      opacity: 0;\n      transition: opacity 0.1s ease;\n      z-index: 0;\n    "], ["\n      opacity: 0;\n      transition: opacity 0.1s ease;\n      z-index: 0;\n    "]))),
        confirmButton: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      align-items: flex-start;\n      background: ", ";\n      display: flex;\n      overflow: hidden;\n      position: absolute;\n      pointer-events: none;\n    "], ["\n      align-items: flex-start;\n      background: ", ";\n      display: flex;\n      overflow: hidden;\n      position: absolute;\n      pointer-events: none;\n    "])), theme.colors.bg1),
        confirmButtonShow: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      z-index: 1;\n      opacity: 1;\n      transition: opacity 0.08s ease-out, transform 0.1s ease-out;\n      transform: translateX(0);\n      pointer-events: all;\n    "], ["\n      z-index: 1;\n      opacity: 1;\n      transition: opacity 0.08s ease-out, transform 0.1s ease-out;\n      transform: translateX(0);\n      pointer-events: all;\n    "]))),
        confirmButtonHide: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      opacity: 0;\n      transition: opacity 0.12s ease-in, transform 0.14s ease-in;\n      transform: translateX(100px);\n    "], ["\n      opacity: 0;\n      transition: opacity 0.12s ease-in, transform 0.14s ease-in;\n      transform: translateX(100px);\n    "]))),
    };
});
// Declare defaultProps directly on the themed component so they are displayed
// in the props table
ConfirmButton.defaultProps = {
    size: 'md',
    confirmText: 'Save',
    disabled: false,
    confirmVariant: 'primary',
};
ConfirmButton.displayName = 'ConfirmButton';
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=ConfirmButton.js.map