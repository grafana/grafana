import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { formattedValueToString, getValueFormat } from '@grafana/data';
import React from 'react';
import { useStyles2 } from '../../themes';
import { trimFileName } from '../../utils/file';
import { Button } from '../Button';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
export var REMOVE_FILE = 'Remove file';
export function FileListItem(_a) {
    var customFile = _a.file, removeFile = _a.removeFile;
    var styles = useStyles2(getStyles);
    var file = customFile.file, progress = customFile.progress, error = customFile.error, abortUpload = customFile.abortUpload, retryUpload = customFile.retryUpload;
    var renderRightSide = function () {
        if (error) {
            return (React.createElement(React.Fragment, null,
                React.createElement("span", { className: styles.error }, error.message),
                retryUpload && (React.createElement(IconButton, { type: "button", "aria-label": "Retry", name: "sync", tooltip: "Retry", tooltipPlacement: "top", onClick: retryUpload })),
                removeFile && (React.createElement(IconButton, { className: retryUpload ? styles.marginLeft : '', type: "button", name: "trash-alt", onClick: function () { return removeFile(customFile); }, tooltip: REMOVE_FILE, "aria-label": REMOVE_FILE }))));
        }
        if (progress && file.size > progress) {
            return (React.createElement(React.Fragment, null,
                React.createElement("progress", { className: styles.progressBar, max: file.size, value: progress }),
                React.createElement("span", { className: styles.paddingLeft },
                    Math.round((progress / file.size) * 100),
                    "%"),
                abortUpload && (React.createElement(Button, { variant: "secondary", type: "button", fill: "text", onClick: abortUpload }, "Cancel upload"))));
        }
        return (removeFile && (React.createElement(IconButton, { name: "trash-alt", onClick: function () { return removeFile(customFile); }, tooltip: REMOVE_FILE, "aria-label": REMOVE_FILE, type: "button", tooltipPlacement: "top" })));
    };
    var valueFormat = getValueFormat('decbytes')(file.size);
    return (React.createElement("div", { className: styles.fileListContainer },
        React.createElement("span", { className: styles.fileNameWrapper },
            React.createElement(Icon, { name: "file-blank", size: "lg", "aria-hidden": true }),
            React.createElement("span", { className: styles.padding }, trimFileName(file.name)),
            React.createElement("span", null, formattedValueToString(valueFormat))),
        React.createElement("div", { className: styles.fileNameWrapper }, renderRightSide())));
}
function getStyles(theme) {
    return {
        fileListContainer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      width: 100%;\n      display: flex;\n      flex-direction: row;\n      align-items: center;\n      justify-content: space-between;\n      padding: ", ";\n      border: 1px dashed ", ";\n      background-color: ", ";\n      margin-top: ", ";\n    "], ["\n      width: 100%;\n      display: flex;\n      flex-direction: row;\n      align-items: center;\n      justify-content: space-between;\n      padding: ", ";\n      border: 1px dashed ", ";\n      background-color: ", ";\n      margin-top: ", ";\n    "])), theme.spacing(2), theme.colors.border.medium, theme.colors.background.secondary, theme.spacing(1)),
        fileNameWrapper: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: row;\n      align-items: center;\n    "], ["\n      display: flex;\n      flex-direction: row;\n      align-items: center;\n    "]))),
        padding: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      padding: ", ";\n    "], ["\n      padding: ", ";\n    "])), theme.spacing(0, 1)),
        paddingLeft: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      padding-left: ", ";\n    "], ["\n      padding-left: ", ";\n    "])), theme.spacing(2)),
        marginLeft: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      margin-left: ", ";\n    "], ["\n      margin-left: ", ";\n    "])), theme.spacing(1)),
        error: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      padding-right: ", ";\n      color: ", ";\n    "], ["\n      padding-right: ", ";\n      color: ", ";\n    "])), theme.spacing(2), theme.colors.error.text),
        progressBar: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      border-radius: ", ";\n      height: 4px;\n      ::-webkit-progress-bar {\n        background-color: ", ";\n        border-radius: ", ";\n      }\n      ::-webkit-progress-value {\n        background-color: ", ";\n        border-radius: ", ";\n      }\n    "], ["\n      border-radius: ", ";\n      height: 4px;\n      ::-webkit-progress-bar {\n        background-color: ", ";\n        border-radius: ", ";\n      }\n      ::-webkit-progress-value {\n        background-color: ", ";\n        border-radius: ", ";\n      }\n    "])), theme.spacing(1), theme.colors.border.weak, theme.spacing(1), theme.colors.primary.main, theme.spacing(1)),
    };
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=FileListItem.js.map