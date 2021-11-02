import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';
export var RuleHealth = function (_a) {
    var rule = _a.rule;
    var style = useStyles2(getStyle);
    if (rule.health === 'err' || rule.health === 'error') {
        return (React.createElement(Tooltip, { theme: "error", content: rule.lastError || 'No error message provided.' },
            React.createElement("div", { className: style.warn },
                React.createElement(Icon, { name: "exclamation-triangle" }),
                React.createElement("span", null, "error"))));
    }
    return React.createElement(React.Fragment, null, rule.health);
};
var getStyle = function (theme) { return ({
    warn: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: inline-flex;\n    flex-direction: row;\n    color: ", ";\n    & > * + * {\n      margin-left: ", ";\n    }\n  "], ["\n    display: inline-flex;\n    flex-direction: row;\n    color: ", ";\n    & > * + * {\n      margin-left: ", ";\n    }\n  "])), theme.colors.warning.text, theme.spacing(1)),
}); };
var templateObject_1;
//# sourceMappingURL=RuleHealth.js.map