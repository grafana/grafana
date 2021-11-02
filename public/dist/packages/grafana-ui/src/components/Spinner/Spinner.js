import { __makeTemplateObject } from "tslib";
import React from 'react';
import { cx, css } from '@emotion/css';
import { stylesFactory } from '../../themes';
import { Icon } from '../Icon/Icon';
var getStyles = stylesFactory(function (size, inline) {
    return {
        wrapper: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      font-size: ", "px;\n      ", "\n    "], ["\n      font-size: ", "px;\n      ", "\n    "])), size, inline
            ? css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            display: inline-block;\n          "], ["\n            display: inline-block;\n          "]))) : ''),
    };
});
/**
 * @public
 */
export var Spinner = function (props) {
    var className = props.className, _a = props.inline, inline = _a === void 0 ? false : _a, iconClassName = props.iconClassName, style = props.style, _b = props.size, size = _b === void 0 ? 16 : _b;
    var styles = getStyles(size, inline);
    return (React.createElement("div", { style: style, className: cx(styles.wrapper, className) },
        React.createElement(Icon, { className: cx('fa-spin', iconClassName), name: "fa fa-spinner" })));
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=Spinner.js.map