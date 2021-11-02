import { __makeTemplateObject } from "tslib";
import React from 'react';
import { isArray, isObject, isUndefined } from 'lodash';
import { useStyles2, Icon } from '@grafana/ui';
import { css } from '@emotion/css';
export var DiffValues = function (_a) {
    var diff = _a.diff;
    var styles = useStyles2(getStyles);
    var hasLeftValue = !isUndefined(diff.originalValue) && !isArray(diff.originalValue) && !isObject(diff.originalValue);
    var hasRightValue = !isUndefined(diff.value) && !isArray(diff.value) && !isObject(diff.value);
    return (React.createElement(React.Fragment, null,
        hasLeftValue && React.createElement("span", { className: styles }, String(diff.originalValue)),
        hasLeftValue && hasRightValue ? React.createElement(Icon, { name: "arrow-right" }) : null,
        hasRightValue && React.createElement("span", { className: styles }, String(diff.value))));
};
var getStyles = function (theme) { return css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  background-color: ", ";\n  border-radius: ", ";\n  color: ", ";\n  font-size: ", ";\n  margin: 0 ", ";\n  padding: ", ";\n"], ["\n  background-color: ", ";\n  border-radius: ", ";\n  color: ", ";\n  font-size: ", ";\n  margin: 0 ", ";\n  padding: ", ";\n"])), theme.colors.action.hover, theme.shape.borderRadius(), theme.colors.text.primary, theme.typography.body.fontSize, theme.spacing(0.5), theme.spacing(0.5, 1)); };
var templateObject_1;
//# sourceMappingURL=DiffValues.js.map