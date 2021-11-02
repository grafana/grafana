import { __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useEffect, useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Button, InlineFieldRow, InlineLabel, useStyles, VerticalGroup } from '@grafana/ui';
import { css } from '@emotion/css';
export var VariableValuesPreview = function (_a) {
    var options = _a.variable.options;
    var _b = __read(useState(20), 2), previewLimit = _b[0], setPreviewLimit = _b[1];
    var _c = __read(useState([]), 2), previewOptions = _c[0], setPreviewOptions = _c[1];
    var showMoreOptions = useCallback(function (event) {
        event.preventDefault();
        setPreviewLimit(previewLimit + 20);
    }, [previewLimit, setPreviewLimit]);
    var styles = useStyles(getStyles);
    useEffect(function () { return setPreviewOptions(options.slice(0, previewLimit)); }, [previewLimit, options]);
    if (!previewOptions.length) {
        return null;
    }
    return (React.createElement(VerticalGroup, { spacing: "none" },
        React.createElement("h5", null, "Preview of values"),
        React.createElement(InlineFieldRow, null, previewOptions.map(function (o, index) { return (React.createElement(InlineFieldRow, { key: o.value + "-" + index, className: styles.optionContainer },
            React.createElement(InlineLabel, { "aria-label": selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption },
                React.createElement("div", { className: styles.label }, o.text)))); })),
        options.length > previewLimit && (React.createElement(InlineFieldRow, { className: styles.optionContainer },
            React.createElement(Button, { onClick: showMoreOptions, variant: "secondary", size: "sm", "aria-label": "Variable editor Preview of Values Show More link" }, "Show more")))));
};
VariableValuesPreview.displayName = 'VariableValuesPreview';
function getStyles(theme) {
    return {
        optionContainer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-left: ", ";\n      margin-bottom: ", ";\n    "], ["\n      margin-left: ", ";\n      margin-bottom: ", ";\n    "])), theme.spacing.xs, theme.spacing.xs),
        label: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      white-space: nowrap;\n      overflow: hidden;\n      text-overflow: ellipsis;\n      max-width: 50vw;\n    "], ["\n      white-space: nowrap;\n      overflow: hidden;\n      text-overflow: ellipsis;\n      max-width: 50vw;\n    "]))),
    };
}
var templateObject_1, templateObject_2;
//# sourceMappingURL=VariableValuesPreview.js.map