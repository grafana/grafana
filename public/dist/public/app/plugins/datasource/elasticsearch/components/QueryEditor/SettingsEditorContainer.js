import { __makeTemplateObject, __read } from "tslib";
import { Icon, InlineSegmentGroup, useTheme2 } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import React, { useState } from 'react';
import { segmentStyles } from './styles';
var getStyles = function (theme, hidden) {
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      max-width: 500px;\n      display: flex;\n      flex-direction: column;\n    "], ["\n      max-width: 500px;\n      display: flex;\n      flex-direction: column;\n    "]))),
        settingsWrapper: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      padding-top: ", ";\n    "], ["\n      padding-top: ", ";\n    "])), theme.spacing(0.5)),
        icon: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      margin-right: ", ";\n    "], ["\n      margin-right: ", ";\n    "])), theme.spacing(0.5)),
        button: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      justify-content: start;\n      ", "\n    "], ["\n      justify-content: start;\n      ", "\n    "])), hidden && css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n        color: ", ";\n      "], ["\n        color: ", ";\n      "])), theme.colors.text.disabled)),
    };
};
export var SettingsEditorContainer = function (_a) {
    var label = _a.label, children = _a.children, _b = _a.hidden, hidden = _b === void 0 ? false : _b;
    var _c = __read(useState(false), 2), open = _c[0], setOpen = _c[1];
    var theme = useTheme2();
    var styles = getStyles(theme, hidden);
    return (React.createElement(InlineSegmentGroup, null,
        React.createElement("div", { className: cx(styles.wrapper) },
            React.createElement("button", { className: cx('gf-form-label query-part', styles.button, segmentStyles), onClick: function () { return setOpen(!open); }, "aria-expanded": open },
                React.createElement(Icon, { name: open ? 'angle-down' : 'angle-right', "aria-hidden": "true", className: styles.icon }),
                label),
            open && React.createElement("div", { className: styles.settingsWrapper }, children))));
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=SettingsEditorContainer.js.map