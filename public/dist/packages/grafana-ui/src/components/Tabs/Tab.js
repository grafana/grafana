import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { selectors } from '@grafana/e2e-selectors';
import { Icon } from '../Icon/Icon';
import { stylesFactory, useTheme2 } from '../../themes';
import { Counter } from './Counter';
import { getFocusStyles } from '../../themes/mixins';
export var Tab = React.forwardRef(function (_a, ref) {
    var label = _a.label, active = _a.active, icon = _a.icon, onChangeTab = _a.onChangeTab, counter = _a.counter, className = _a.className, href = _a.href, otherProps = __rest(_a, ["label", "active", "icon", "onChangeTab", "counter", "className", "href"]);
    var theme = useTheme2();
    var tabsStyles = getTabStyles(theme);
    var content = function () { return (React.createElement(React.Fragment, null,
        icon && React.createElement(Icon, { name: icon }),
        label,
        typeof counter === 'number' && React.createElement(Counter, { value: counter }))); };
    var linkClass = cx(tabsStyles.link, active ? tabsStyles.activeStyle : tabsStyles.notActive);
    return (React.createElement("li", { className: tabsStyles.item },
        React.createElement("a", __assign({ href: href, className: linkClass }, otherProps, { onClick: onChangeTab, "aria-label": otherProps['aria-label'] || selectors.components.Tab.title(label), ref: ref }), content())));
});
Tab.displayName = 'Tab';
var getTabStyles = stylesFactory(function (theme) {
    return {
        item: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      list-style: none;\n      position: relative;\n      display: flex;\n    "], ["\n      list-style: none;\n      position: relative;\n      display: flex;\n    "]))),
        link: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      color: ", ";\n      padding: ", ";\n      display: block;\n      height: 100%;\n      svg {\n        margin-right: ", ";\n      }\n\n      &:focus-visible {\n+        ", "\n      }\n    "], ["\n      color: ", ";\n      padding: ", ";\n      display: block;\n      height: 100%;\n      svg {\n        margin-right: ", ";\n      }\n\n      &:focus-visible {\n+        ", "\n      }\n    "])), theme.colors.text.secondary, theme.spacing(1.5, 2, 1), theme.spacing(1), getFocusStyles(theme)),
        notActive: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      a:hover,\n      &:hover,\n      &:focus {\n        color: ", ";\n\n        &::before {\n          display: block;\n          content: ' ';\n          position: absolute;\n          left: 0;\n          right: 0;\n          height: 4px;\n          border-radius: 2px;\n          bottom: 0px;\n          background: ", ";\n        }\n      }\n    "], ["\n      a:hover,\n      &:hover,\n      &:focus {\n        color: ", ";\n\n        &::before {\n          display: block;\n          content: ' ';\n          position: absolute;\n          left: 0;\n          right: 0;\n          height: 4px;\n          border-radius: 2px;\n          bottom: 0px;\n          background: ", ";\n        }\n      }\n    "])), theme.colors.text.primary, theme.colors.action.hover),
        activeStyle: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      label: activeTabStyle;\n      color: ", ";\n      overflow: hidden;\n      font-weight: ", ";\n\n      a {\n        color: ", ";\n      }\n\n      &::before {\n        display: block;\n        content: ' ';\n        position: absolute;\n        left: 0;\n        right: 0;\n        height: 4px;\n        border-radius: 2px;\n        bottom: 0px;\n        background-image: ", " !important;\n      }\n    "], ["\n      label: activeTabStyle;\n      color: ", ";\n      overflow: hidden;\n      font-weight: ", ";\n\n      a {\n        color: ", ";\n      }\n\n      &::before {\n        display: block;\n        content: ' ';\n        position: absolute;\n        left: 0;\n        right: 0;\n        height: 4px;\n        border-radius: 2px;\n        bottom: 0px;\n        background-image: ", " !important;\n      }\n    "])), theme.colors.text.primary, theme.typography.fontWeightMedium, theme.colors.text.primary, theme.colors.gradients.brandHorizontal),
    };
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=Tab.js.map