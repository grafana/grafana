import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { stylesFactory } from '../../themes';
export var FullWidthButtonContainer = function (_a) {
    var className = _a.className, children = _a.children;
    var styles = getStyles();
    return React.createElement("div", { className: cx(styles, className) }, children);
};
var getStyles = stylesFactory(function () {
    return css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: flex;\n\n    button {\n      flex-grow: 1;\n      justify-content: center;\n    }\n\n    > * {\n      flex-grow: 1;\n    }\n\n    label {\n      flex-grow: 1;\n      text-align: center;\n    }\n  "], ["\n    display: flex;\n\n    button {\n      flex-grow: 1;\n      justify-content: center;\n    }\n\n    > * {\n      flex-grow: 1;\n    }\n\n    label {\n      flex-grow: 1;\n      text-align: center;\n    }\n  "])));
});
var templateObject_1;
//# sourceMappingURL=FullWidthButtonContainer.js.map