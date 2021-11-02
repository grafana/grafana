import { __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { VariableTextAreaField } from './VariableTextAreaField';
import { useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
export var LEGACY_VARIABLE_QUERY_EDITOR_NAME = 'Grafana-LegacyVariableQueryEditor';
export var LegacyVariableQueryEditor = function (_a) {
    var onChange = _a.onChange, query = _a.query;
    var styles = useStyles(getStyles);
    var _b = __read(useState(query), 2), value = _b[0], setValue = _b[1];
    var onValueChange = function (event) {
        setValue(event.currentTarget.value);
    };
    var onBlur = useCallback(function (event) {
        onChange(event.currentTarget.value, event.currentTarget.value);
    }, [onChange]);
    return (React.createElement("div", { className: styles.container },
        React.createElement(VariableTextAreaField, { name: "Query", value: value, placeholder: "metric name or tags query", width: 100, onChange: onValueChange, onBlur: onBlur, required: true, labelWidth: 20, ariaLabel: selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput })));
};
function getStyles(theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing.xs),
    };
}
LegacyVariableQueryEditor.displayName = LEGACY_VARIABLE_QUERY_EDITOR_NAME;
var templateObject_1;
//# sourceMappingURL=LegacyVariableQueryEditor.js.map