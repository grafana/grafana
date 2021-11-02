import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
export var getFormStyles = function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      align-items: center;\n      display: flex;\n      flex-flow: row nowrap;\n\n      & > * + * {\n        margin-left: ", ";\n      }\n    "], ["\n      align-items: center;\n      display: flex;\n      flex-flow: row nowrap;\n\n      & > * + * {\n        margin-left: ", ";\n      }\n    "])), theme.spacing(1)),
        input: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      flex: 1;\n    "], ["\n      flex: 1;\n    "]))),
        timingContainer: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      max-width: ", ";\n    "], ["\n      max-width: ", ";\n    "])), theme.spacing(33)),
        smallInput: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      width: ", ";\n    "], ["\n      width: ", ";\n    "])), theme.spacing(6.5)),
        linkText: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      text-decoration: underline;\n    "], ["\n      text-decoration: underline;\n    "]))),
        collapse: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      border: none;\n      background: none;\n      color: ", ";\n    "], ["\n      border: none;\n      background: none;\n      color: ", ";\n    "])), theme.colors.text.primary),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
//# sourceMappingURL=formStyles.js.map