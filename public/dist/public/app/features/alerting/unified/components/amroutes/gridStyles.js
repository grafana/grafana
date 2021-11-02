import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
export var getGridStyles = function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: grid;\n      font-style: ", ";\n      grid-template-columns: ", " auto;\n\n      ", " {\n        grid-template-columns: 100%;\n      }\n    "], ["\n      display: grid;\n      font-style: ", ";\n      grid-template-columns: ", " auto;\n\n      ", " {\n        grid-template-columns: 100%;\n      }\n    "])), theme.typography.fontSize, theme.spacing(15.5), theme.breakpoints.down('md')),
        titleCell: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      color: ", ";\n    "], ["\n      color: ", ";\n    "])), theme.colors.text.primary),
        valueCell: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      color: ", ";\n      margin-bottom: ", ";\n    "], ["\n      color: ", ";\n      margin-bottom: ", ";\n    "])), theme.colors.text.secondary, theme.spacing(1)),
    };
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=gridStyles.js.map