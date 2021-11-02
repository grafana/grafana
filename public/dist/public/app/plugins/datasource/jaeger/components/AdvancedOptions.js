import { __assign, __makeTemplateObject, __read } from "tslib";
import { css } from '@emotion/css';
import { Icon, InlineField, InlineFieldRow, InlineLabel, Input, useStyles } from '@grafana/ui';
import React, { useState } from 'react';
import { CSSTransition } from 'react-transition-group';
var durationPlaceholder = 'e.g. 1.2s, 100ms, 500us';
export function AdvancedOptions(_a) {
    var query = _a.query, onChange = _a.onChange;
    var _b = __read(useState(false), 2), showAdvancedOptions = _b[0], setShowAdvancedOptions = _b[1];
    var styles = useStyles(getStyles);
    return (React.createElement("div", null,
        React.createElement(InlineFieldRow, null,
            React.createElement("div", { className: styles.advancedOptionsContainer, onClick: function () { return setShowAdvancedOptions(!showAdvancedOptions); } },
                React.createElement(InlineLabel, { as: "div" },
                    "Advanced options",
                    ' ',
                    React.createElement(Icon, { className: showAdvancedOptions ? styles.angleUp : styles.angleDown, name: "angle-down" })))),
        React.createElement(CSSTransition, { in: showAdvancedOptions, mountOnEnter: true, unmountOnExit: true, timeout: 300, classNames: styles },
            React.createElement("div", null,
                React.createElement(InlineFieldRow, null,
                    React.createElement(InlineField, { label: "Min Duration", labelWidth: 21, grow: true },
                        React.createElement(Input, { value: query.minDuration || '', placeholder: durationPlaceholder, onChange: function (v) {
                                return onChange(__assign(__assign({}, query), { minDuration: v.currentTarget.value }));
                            } }))),
                React.createElement(InlineFieldRow, null,
                    React.createElement(InlineField, { label: "Max Duration", labelWidth: 21, grow: true },
                        React.createElement(Input, { value: query.maxDuration || '', placeholder: durationPlaceholder, onChange: function (v) {
                                return onChange(__assign(__assign({}, query), { maxDuration: v.currentTarget.value }));
                            } }))),
                React.createElement(InlineFieldRow, null,
                    React.createElement(InlineField, { label: "Limit", labelWidth: 21, grow: true, tooltip: "Maximum numbers of returned results" },
                        React.createElement(Input, { value: query.limit || '', type: "number", onChange: function (v) {
                                return onChange(__assign(__assign({}, query), { limit: v.currentTarget.value ? parseInt(v.currentTarget.value, 10) : undefined }));
                            } })))))));
}
function getStyles(theme) {
    return {
        advancedOptionsContainer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin: 0 ", " ", " 0;\n      width: 100%;\n      cursor: pointer;\n    "], ["\n      margin: 0 ", " ", " 0;\n      width: 100%;\n      cursor: pointer;\n    "])), theme.spacing.xs, theme.spacing.xs),
        enter: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: enter;\n      height: 0;\n      opacity: 0;\n    "], ["\n      label: enter;\n      height: 0;\n      opacity: 0;\n    "]))),
        enterActive: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      label: enterActive;\n      height: 108px;\n      opacity: 1;\n      transition: height 300ms ease, opacity 300ms ease;\n    "], ["\n      label: enterActive;\n      height: 108px;\n      opacity: 1;\n      transition: height 300ms ease, opacity 300ms ease;\n    "]))),
        exit: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      label: exit;\n      height: 108px;\n      opacity: 1;\n    "], ["\n      label: exit;\n      height: 108px;\n      opacity: 1;\n    "]))),
        exitActive: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      label: exitActive;\n      height: 0;\n      opacity: 0;\n      transition: height 300ms ease, opacity 300ms ease;\n    "], ["\n      label: exitActive;\n      height: 0;\n      opacity: 0;\n      transition: height 300ms ease, opacity 300ms ease;\n    "]))),
        angleUp: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      transform: rotate(-180deg);\n      transition: transform 300ms;\n    "], ["\n      transform: rotate(-180deg);\n      transition: transform 300ms;\n    "]))),
        angleDown: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      transform: rotate(0deg);\n      transition: transform 300ms;\n    "], ["\n      transform: rotate(0deg);\n      transition: transform 300ms;\n    "]))),
    };
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=AdvancedOptions.js.map