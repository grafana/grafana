import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { useTheme, stylesFactory } from '../../../themes';
export var TimeZoneTitle = function (_a) {
    var title = _a.title;
    var theme = useTheme();
    var styles = getStyles(theme);
    if (!title) {
        return null;
    }
    return React.createElement("span", { className: styles.title }, title);
};
var getStyles = stylesFactory(function (theme) {
    return {
        title: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      font-weight: ", ";\n      text-overflow: ellipsis;\n    "], ["\n      font-weight: ", ";\n      text-overflow: ellipsis;\n    "])), theme.typography.weight.regular),
    };
});
var templateObject_1;
//# sourceMappingURL=TimeZoneTitle.js.map