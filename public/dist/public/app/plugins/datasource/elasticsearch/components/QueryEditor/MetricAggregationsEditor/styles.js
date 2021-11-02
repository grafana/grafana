import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
export var getStyles = function (theme, hidden) {
    return {
        color: hidden && css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        &,\n        &:hover,\n        label,\n        a {\n          color: ", ";\n        }\n      "], ["\n        &,\n        &:hover,\n        label,\n        a {\n          color: ", ";\n        }\n      "])), hidden ? theme.colors.text.disabled : theme.colors.text.primary),
    };
};
var templateObject_1;
//# sourceMappingURL=styles.js.map