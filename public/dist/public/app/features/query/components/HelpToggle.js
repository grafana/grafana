import { __makeTemplateObject, __read } from "tslib";
import { Icon, InfoBox, stylesFactory, useTheme } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import React, { useState } from 'react';
var getStyles = stylesFactory(function (theme) { return ({
    infoBox: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-top: ", ";\n  "], ["\n    margin-top: ", ";\n  "])), theme.spacing.xs),
}); });
export var HelpToggle = function (_a) {
    var children = _a.children;
    var _b = __read(useState(false), 2), isHelpVisible = _b[0], setIsHelpVisible = _b[1];
    var theme = useTheme();
    var styles = getStyles(theme);
    return (React.createElement(React.Fragment, null,
        React.createElement("button", { className: "gf-form-label query-keyword pointer", onClick: function (_) { return setIsHelpVisible(!isHelpVisible); } },
            "Help",
            React.createElement(Icon, { name: isHelpVisible ? 'angle-down' : 'angle-right' })),
        isHelpVisible && React.createElement(InfoBox, { className: cx(styles.infoBox) }, children)));
};
var templateObject_1;
//# sourceMappingURL=HelpToggle.js.map