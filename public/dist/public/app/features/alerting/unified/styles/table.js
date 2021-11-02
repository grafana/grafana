import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
export var getAlertTableStyles = function (theme) { return ({
    table: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    width: 100%;\n    border-radius: ", ";\n    border: solid 1px ", ";\n    background-color: ", ";\n\n    th {\n      padding: ", ";\n    }\n\n    td {\n      padding: 0 ", ";\n    }\n\n    tr {\n      height: 38px;\n    }\n  "], ["\n    width: 100%;\n    border-radius: ", ";\n    border: solid 1px ", ";\n    background-color: ", ";\n\n    th {\n      padding: ", ";\n    }\n\n    td {\n      padding: 0 ", ";\n    }\n\n    tr {\n      height: 38px;\n    }\n  "])), theme.shape.borderRadius(), theme.colors.border.weak, theme.colors.background.secondary, theme.spacing(1), theme.spacing(1)),
    evenRow: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    background-color: ", ";\n  "], ["\n    background-color: ", ";\n  "])), theme.colors.background.primary),
    colExpand: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    width: 36px;\n  "], ["\n    width: 36px;\n  "]))),
    actionsCell: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    text-align: right;\n    width: 1%;\n    white-space: nowrap;\n\n    & > * + * {\n      margin-left: ", ";\n    }\n  "], ["\n    text-align: right;\n    width: 1%;\n    white-space: nowrap;\n\n    & > * + * {\n      margin-left: ", ";\n    }\n  "])), theme.spacing(1)),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=table.js.map