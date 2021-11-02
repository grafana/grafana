import { __makeTemplateObject } from "tslib";
import React from 'react';
import { stylesFactory, useTheme2 } from '../../themes';
import { css, cx } from '@emotion/css';
var getTabsBarStyles = stylesFactory(function (theme, hideBorder) {
    if (hideBorder === void 0) { hideBorder = false; }
    return {
        tabsWrapper: !hideBorder && css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        border-bottom: 1px solid ", ";\n      "], ["\n        border-bottom: 1px solid ", ";\n      "])), theme.colors.border.weak),
        tabs: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      position: relative;\n      display: flex;\n      height: 41px;\n    "], ["\n      position: relative;\n      display: flex;\n      height: 41px;\n    "]))),
    };
});
export var TabsBar = React.forwardRef(function (_a, ref) {
    var children = _a.children, className = _a.className, hideBorder = _a.hideBorder;
    var theme = useTheme2();
    var tabsStyles = getTabsBarStyles(theme, hideBorder);
    return (React.createElement("div", { className: cx(tabsStyles.tabsWrapper, className), ref: ref },
        React.createElement("ul", { className: tabsStyles.tabs }, children)));
});
TabsBar.displayName = 'TabsBar';
var templateObject_1, templateObject_2;
//# sourceMappingURL=TabsBar.js.map