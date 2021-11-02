import { __assign, __makeTemplateObject, __rest } from "tslib";
import { Button } from '@grafana/ui/src/components/Button';
import React from 'react';
import { css, cx } from '@emotion/css';
import { useStyles } from '@grafana/ui';
export var ActionButton = function (_a) {
    var className = _a.className, restProps = __rest(_a, ["className"]);
    return (React.createElement(Button, __assign({ variant: "secondary", size: "xs", className: cx(useStyles(getStyle), className) }, restProps)));
};
export var getStyle = function (theme) { return css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  height: 24px;\n  font-size: ", ";\n"], ["\n  height: 24px;\n  font-size: ", ";\n"])), theme.typography.size.sm); };
var templateObject_1;
//# sourceMappingURL=ActionButton.js.map