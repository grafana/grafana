import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { useTheme2, stylesFactory } from '../../themes';
import { css, cx } from '@emotion/css';
import { Icon } from '../Icon/Icon';
export var getLabelStyles = stylesFactory(function (theme) {
    return {
        label: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: Label;\n      font-size: ", ";\n      font-weight: ", ";\n      line-height: 1.25;\n      margin-bottom: ", ";\n      color: ", ";\n      max-width: 480px;\n    "], ["\n      label: Label;\n      font-size: ", ";\n      font-weight: ", ";\n      line-height: 1.25;\n      margin-bottom: ", ";\n      color: ", ";\n      max-width: 480px;\n    "])), theme.typography.size.sm, theme.typography.fontWeightMedium, theme.spacing(0.5), theme.colors.text.primary),
        labelContent: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n    "], ["\n      display: flex;\n      align-items: center;\n    "]))),
        description: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      label: Label-description;\n      color: ", ";\n      font-size: ", ";\n      font-weight: ", ";\n      margin-top: ", ";\n      display: block;\n    "], ["\n      label: Label-description;\n      color: ", ";\n      font-size: ", ";\n      font-weight: ", ";\n      margin-top: ", ";\n      display: block;\n    "])), theme.colors.text.secondary, theme.typography.size.sm, theme.typography.fontWeightRegular, theme.spacing(0.25)),
        categories: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      label: Label-categories;\n      display: inline-flex;\n      align-items: center;\n    "], ["\n      label: Label-categories;\n      display: inline-flex;\n      align-items: center;\n    "]))),
        chevron: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      margin: 0 ", ";\n    "], ["\n      margin: 0 ", ";\n    "])), theme.spacing(0.25)),
    };
});
export var Label = function (_a) {
    var children = _a.children, description = _a.description, className = _a.className, category = _a.category, labelProps = __rest(_a, ["children", "description", "className", "category"]);
    var theme = useTheme2();
    var styles = getLabelStyles(theme);
    var categories = category === null || category === void 0 ? void 0 : category.map(function (c, i) {
        return (React.createElement("span", { className: styles.categories, key: c + "/" + i },
            React.createElement("span", null, c),
            React.createElement(Icon, { name: "angle-right", className: styles.chevron })));
    });
    return (React.createElement("div", { className: cx(styles.label, className) },
        React.createElement("label", __assign({}, labelProps),
            React.createElement("div", { className: styles.labelContent },
                categories,
                children),
            description && React.createElement("span", { className: styles.description }, description))));
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=Label.js.map