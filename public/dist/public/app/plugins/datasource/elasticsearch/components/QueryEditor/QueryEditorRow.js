import { __makeTemplateObject } from "tslib";
import { IconButton, InlineFieldRow, InlineLabel, InlineSegmentGroup, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { noop } from 'lodash';
import React from 'react';
export var QueryEditorRow = function (_a) {
    var children = _a.children, label = _a.label, onRemoveClick = _a.onRemoveClick, onHideClick = _a.onHideClick, _b = _a.hidden, hidden = _b === void 0 ? false : _b;
    var styles = useStyles2(getStyles);
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineSegmentGroup, null,
            React.createElement(InlineLabel, { width: 17, as: "div" },
                React.createElement("span", null, label),
                React.createElement("span", { className: styles.iconWrapper },
                    onHideClick && (React.createElement(IconButton, { name: hidden ? 'eye-slash' : 'eye', onClick: onHideClick, surface: "header", size: "sm", "aria-pressed": hidden, "aria-label": "hide metric", className: styles.icon })),
                    React.createElement(IconButton, { name: "trash-alt", surface: "header", size: "sm", className: styles.icon, onClick: onRemoveClick || noop, disabled: !onRemoveClick, "aria-label": "remove metric" })))),
        children));
};
var getStyles = function (theme) {
    return {
        iconWrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n    "], ["\n      display: flex;\n    "]))),
        icon: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      color: ", ";\n      margin-left: ", ";\n    "], ["\n      color: ", ";\n      margin-left: ", ";\n    "])), theme.colors.text.secondary, theme.spacing(0.25)),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=QueryEditorRow.js.map