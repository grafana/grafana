import { __rest } from "tslib";
// @ts-nocheck
import { cx } from '@emotion/css';
import React from 'react';
import { Select, Spinner, useTheme } from '@grafana/ui';
import { Field } from './Field';
import { Messages } from './FieldAdapters.messages';
import { getStyles } from './FieldAdapters.styles';
export const SelectFieldAdapter = (_a) => {
    var { input, className, options, label, meta, dataTestId, showErrorOnBlur = true, noOptionsMessage } = _a, props = __rest(_a, ["input", "className", "options", "label", "meta", "dataTestId", "showErrorOnBlur", "noOptionsMessage"]);
    const theme = useTheme();
    const styles = getStyles(theme);
    const validationError = (!showErrorOnBlur || meta.touched) && meta.error;
    return (React.createElement(Field, { label: label },
        React.createElement("div", { "data-testid": dataTestId },
            React.createElement(Select, Object.assign({}, input, props, { options: options, className: cx(styles.input, className), invalid: !!validationError, noOptionsMessage: noOptionsMessage })),
            React.createElement("div", { "data-testid": "select-field-error-message", className: styles.errorMessage }, validationError))));
};
export const AsyncSelectFieldAdapter = (_a) => {
    var { input, className, loading, options, label, meta, dataTestId, noOptionsMessage } = _a, props = __rest(_a, ["input", "className", "loading", "options", "label", "meta", "dataTestId", "noOptionsMessage"]);
    const theme = useTheme();
    const styles = getStyles(theme);
    return (React.createElement(Field, { label: label },
        React.createElement("div", { "data-testid": dataTestId },
            React.createElement("div", { className: styles.asyncSelectWrapper },
                React.createElement(Select, Object.assign({}, input, props, { options: loading ? [] : options, className: cx(styles.input, className), invalid: meta.touched && meta.error, noOptionsMessage: loading ? Messages.loadingOptions : noOptionsMessage })),
                loading && React.createElement(Spinner, { className: styles.selectSpinner })),
            React.createElement("div", { "data-testid": "async-select-field-error-message", className: styles.errorMessage }, meta.touched && meta.error))));
};
//# sourceMappingURL=FieldAdapters.js.map