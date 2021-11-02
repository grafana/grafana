import { __makeTemplateObject } from "tslib";
import React from 'react';
import { stylesFactory } from '../../themes';
import { css } from '@emotion/css';
var getStyles = stylesFactory(function () {
    return css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    width: 500px;\n    margin: 64px auto;\n  "], ["\n    width: 500px;\n    margin: 64px auto;\n  "])));
});
export var ErrorWithStack = function (_a) {
    var error = _a.error, errorInfo = _a.errorInfo, title = _a.title;
    return (React.createElement("div", { className: getStyles() },
        React.createElement("h2", null, title),
        React.createElement("details", { style: { whiteSpace: 'pre-wrap' } },
            error && error.toString(),
            React.createElement("br", null),
            errorInfo && errorInfo.componentStack)));
};
ErrorWithStack.displayName = 'ErrorWithStack';
var templateObject_1;
//# sourceMappingURL=ErrorWithStack.js.map