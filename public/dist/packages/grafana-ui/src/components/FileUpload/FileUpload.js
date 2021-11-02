import { __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useState } from 'react';
import { css, cx } from '@emotion/css';
import { Icon } from '../index';
import { stylesFactory, useTheme2 } from '../../themes';
import { getButtonStyles } from '../Button';
import { trimFileName } from '../../utils/file';
export var FileUpload = function (_a) {
    var onFileUpload = _a.onFileUpload, className = _a.className, _b = _a.children, children = _b === void 0 ? 'Upload file' : _b, _c = _a.accept, accept = _c === void 0 ? '*' : _c, _d = _a.size, size = _d === void 0 ? 'md' : _d;
    var theme = useTheme2();
    var style = getStyles(theme, size);
    var _e = __read(useState(''), 2), fileName = _e[0], setFileName = _e[1];
    var onChange = useCallback(function (event) {
        var _a, _b, _c;
        var file = (_b = (_a = event.currentTarget) === null || _a === void 0 ? void 0 : _a.files) === null || _b === void 0 ? void 0 : _b[0];
        if (file) {
            setFileName((_c = file.name) !== null && _c !== void 0 ? _c : '');
        }
        onFileUpload(event);
    }, [onFileUpload]);
    return (React.createElement(React.Fragment, null,
        React.createElement("label", { className: cx(style.button, className) },
            React.createElement(Icon, { name: "upload", className: style.icon }),
            children,
            React.createElement("input", { type: "file", id: "fileUpload", className: style.fileUpload, onChange: onChange, multiple: false, accept: accept })),
        fileName && (React.createElement("span", { "aria-label": "File name", className: style.fileName }, trimFileName(fileName)))));
};
var getStyles = stylesFactory(function (theme, size) {
    var buttonStyles = getButtonStyles({ theme: theme, variant: 'primary', size: size, iconOnly: false });
    return {
        fileUpload: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: none;\n    "], ["\n      display: none;\n    "]))),
        button: buttonStyles.button,
        icon: buttonStyles.icon,
        fileName: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin-left: ", ";\n    "], ["\n      margin-left: ", ";\n    "])), theme.spacing(0.5)),
    };
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=FileUpload.js.map