import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { FieldSet, useStyles2 } from '@grafana/ui';
import React from 'react';
export var RuleEditorSection = function (_a) {
    var title = _a.title, stepNo = _a.stepNo, children = _a.children, description = _a.description;
    var styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.parent },
        React.createElement("div", null,
            React.createElement("span", { className: styles.stepNo }, stepNo)),
        React.createElement("div", { className: styles.content },
            React.createElement(FieldSet, { label: title, className: styles.fieldset },
                description && React.createElement("p", { className: styles.description }, description),
                children))));
};
var getStyles = function (theme) { return ({
    fieldset: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    legend {\n      font-size: 16px;\n      padding-top: ", ";\n    }\n  "], ["\n    legend {\n      font-size: 16px;\n      padding-top: ", ";\n    }\n  "])), theme.spacing(0.5)),
    parent: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: row;\n    max-width: ", ";\n    & + & {\n      margin-top: ", ";\n    }\n  "], ["\n    display: flex;\n    flex-direction: row;\n    max-width: ", ";\n    & + & {\n      margin-top: ", ";\n    }\n  "])), theme.breakpoints.values.xl, theme.spacing(4)),
    description: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-top: -", ";\n  "], ["\n    margin-top: -", ";\n  "])), theme.spacing(2)),
    stepNo: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    display: inline-block;\n    width: ", ";\n    height: ", ";\n    line-height: ", ";\n    border-radius: ", ";\n    text-align: center;\n    color: ", ";\n    background-color: ", ";\n    font-size: ", ";\n    margin-right: ", ";\n  "], ["\n    display: inline-block;\n    width: ", ";\n    height: ", ";\n    line-height: ", ";\n    border-radius: ", ";\n    text-align: center;\n    color: ", ";\n    background-color: ", ";\n    font-size: ", ";\n    margin-right: ", ";\n  "])), theme.spacing(4), theme.spacing(4), theme.spacing(4), theme.spacing(4), theme.colors.text.maxContrast, theme.colors.background.canvas, theme.typography.size.lg, theme.spacing(2)),
    content: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    flex: 1;\n  "], ["\n    flex: 1;\n  "]))),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=RuleEditorSection.js.map