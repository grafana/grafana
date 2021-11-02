import { __makeTemplateObject, __read } from "tslib";
import { css, cx } from '@emotion/css';
import { Icon, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';
export var CollapsibleSection = function (_a) {
    var label = _a.label, description = _a.description, children = _a.children, className = _a.className;
    var styles = useStyles2(getStyles);
    var _b = __read(useState(true), 2), isCollapsed = _b[0], setIsCollapsed = _b[1];
    var toggleCollapse = function () { return setIsCollapsed(!isCollapsed); };
    return (React.createElement("div", { className: cx(styles.wrapper, className) },
        React.createElement("div", { className: styles.heading, onClick: toggleCollapse },
            React.createElement(Icon, { className: styles.caret, size: "xl", name: isCollapsed ? 'angle-right' : 'angle-down' }),
            React.createElement("h6", null, label)),
        description && React.createElement("p", { className: styles.description }, description),
        React.createElement("div", { className: isCollapsed ? styles.hidden : undefined }, children)));
};
var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-top: ", ";\n    padding-bottom: ", ";\n  "], ["\n    margin-top: ", ";\n    padding-bottom: ", ";\n  "])), theme.spacing(1), theme.spacing(1)),
    caret: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    margin-left: -", "; // make it align with fields despite icon size\n  "], ["\n    margin-left: -", "; // make it align with fields despite icon size\n  "])), theme.spacing(0.5)),
    heading: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    cursor: pointer;\n    h6 {\n      display: inline-block;\n    }\n  "], ["\n    cursor: pointer;\n    h6 {\n      display: inline-block;\n    }\n  "]))),
    hidden: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    display: none;\n  "], ["\n    display: none;\n  "]))),
    description: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    color: ", ";\n    font-size: ", ";\n    font-weight: ", ";\n    margin: 0;\n  "], ["\n    color: ", ";\n    font-size: ", ";\n    font-weight: ", ";\n    margin: 0;\n  "])), theme.colors.text.secondary, theme.typography.size.sm, theme.typography.fontWeightRegular),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=CollapsibleSection.js.map