import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
export var DetailsField = function (_a) {
    var className = _a.className, label = _a.label, horizontal = _a.horizontal, children = _a.children;
    var styles = useStyles2(getStyles);
    return (React.createElement("div", { className: cx(className, styles.field, horizontal ? styles.fieldHorizontal : styles.fieldVertical) },
        React.createElement("div", null, label),
        React.createElement("div", null, children)));
};
var getStyles = function (theme) { return ({
    fieldHorizontal: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    flex-direction: row;\n    ", " {\n      flex-direction: column;\n    }\n  "], ["\n    flex-direction: row;\n    ", " {\n      flex-direction: column;\n    }\n  "])), theme.breakpoints.down('md')),
    fieldVertical: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    flex-direction: column;\n  "], ["\n    flex-direction: column;\n  "]))),
    field: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    display: flex;\n    margin: ", " 0;\n\n    & > div:first-child {\n      width: 110px;\n      padding-right: ", ";\n      font-size: ", ";\n      font-weight: ", ";\n      line-height: 1.8;\n    }\n    & > div:nth-child(2) {\n      flex: 1;\n      color: ", ";\n    }\n  "], ["\n    display: flex;\n    margin: ", " 0;\n\n    & > div:first-child {\n      width: 110px;\n      padding-right: ", ";\n      font-size: ", ";\n      font-weight: ", ";\n      line-height: 1.8;\n    }\n    & > div:nth-child(2) {\n      flex: 1;\n      color: ", ";\n    }\n  "])), theme.spacing(2), theme.spacing(1), theme.typography.size.sm, theme.typography.fontWeightBold, theme.colors.text.secondary),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=DetailsField.js.map