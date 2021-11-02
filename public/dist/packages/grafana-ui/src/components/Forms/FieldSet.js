import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { stylesFactory, useTheme2 } from '../../themes';
import { Legend } from './Legend';
export var FieldSet = function (_a) {
    var label = _a.label, children = _a.children, className = _a.className, rest = __rest(_a, ["label", "children", "className"]);
    var theme = useTheme2();
    var styles = getStyles(theme);
    return (React.createElement("fieldset", __assign({ className: cx(styles.wrapper, className) }, rest),
        label && React.createElement(Legend, null, label),
        children));
};
var getStyles = stylesFactory(function (theme) {
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-bottom: ", ";\n\n      &:last-child {\n        margin-bottom: 0;\n      }\n    "], ["\n      margin-bottom: ", ";\n\n      &:last-child {\n        margin-bottom: 0;\n      }\n    "])), theme.spacing(4)),
    };
});
var templateObject_1;
//# sourceMappingURL=FieldSet.js.map