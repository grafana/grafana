import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { useStyles, Icon } from '@grafana/ui';
export var CollapseToggle = function (_a) {
    var isCollapsed = _a.isCollapsed, onToggle = _a.onToggle, className = _a.className, text = _a.text, _b = _a.size, size = _b === void 0 ? 'xl' : _b, restOfProps = __rest(_a, ["isCollapsed", "onToggle", "className", "text", "size"]);
    var styles = useStyles(getStyles);
    return (React.createElement("button", __assign({ className: cx(styles.expandButton, className), onClick: function () { return onToggle(!isCollapsed); } }, restOfProps),
        React.createElement(Icon, { size: size, name: isCollapsed ? 'angle-right' : 'angle-down' }),
        text));
};
export var getStyles = function () { return ({
    expandButton: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    background: none;\n    border: none;\n\n    outline: none !important;\n\n    display: inline-flex;\n    align-items: center;\n\n    svg {\n      margin-bottom: 0;\n    }\n  "], ["\n    background: none;\n    border: none;\n\n    outline: none !important;\n\n    display: inline-flex;\n    align-items: center;\n\n    svg {\n      margin-bottom: 0;\n    }\n  "]))),
}); };
var templateObject_1;
//# sourceMappingURL=CollapseToggle.js.map