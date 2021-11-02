import { __makeTemplateObject } from "tslib";
import React from 'react';
import { IconButton, useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
export var AlertLabel = function (_a) {
    var labelKey = _a.labelKey, value = _a.value, _b = _a.operator, operator = _b === void 0 ? '=' : _b, onRemoveLabel = _a.onRemoveLabel;
    return (React.createElement("div", { className: useStyles(getStyles) },
        labelKey,
        operator,
        value,
        !!onRemoveLabel && React.createElement(IconButton, { name: "times", size: "xs", onClick: onRemoveLabel })));
};
export var getStyles = function (theme) { return css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  padding: ", " ", ";\n  border-radius: ", ";\n  border: solid 1px ", ";\n  font-size: ", ";\n  background-color: ", ";\n  font-weight: ", ";\n  color: ", ";\n  display: inline-block;\n  line-height: 1.2;\n"], ["\n  padding: ", " ", ";\n  border-radius: ", ";\n  border: solid 1px ", ";\n  font-size: ", ";\n  background-color: ", ";\n  font-weight: ", ";\n  color: ", ";\n  display: inline-block;\n  line-height: 1.2;\n"])), theme.spacing.xs, theme.spacing.sm, theme.border.radius.sm, theme.colors.border2, theme.typography.size.sm, theme.colors.bg2, theme.typography.weight.bold, theme.colors.formLabel); };
var templateObject_1;
//# sourceMappingURL=AlertLabel.js.map