import { __rest } from "tslib";
import { cx } from '@emotion/css';
import React, { useMemo } from 'react';
import { Field } from 'react-final-form';
import { useStyles2 } from '@grafana/ui';
import { compose } from 'app/percona/shared/helpers/validatorsForm';
import { LabelCore } from '../LabelCore';
import { getStyles } from './PasswordInput.styles';
export const PasswordInputField = React.memo((_a) => {
    var { className, disabled = false, fieldClassName, inputProps, label, name, inputId = `input-${name}-id`, placeholder, required = false, showErrorOnBlur = false, showErrorOnRender = false, validators, tooltipText = '', tooltipLink, tooltipLinkText, tooltipIcon, tooltipDataTestId, tooltipLinkTarget } = _a, fieldConfig = __rest(_a, ["className", "disabled", "fieldClassName", "inputProps", "label", "name", "inputId", "placeholder", "required", "showErrorOnBlur", "showErrorOnRender", "validators", "tooltipText", "tooltipLink", "tooltipLinkText", "tooltipIcon", "tooltipDataTestId", "tooltipLinkTarget"]);
    const styles = useStyles2(getStyles);
    const validate = useMemo(() => (Array.isArray(validators) ? compose(validators) : undefined), [validators]);
    return (React.createElement(Field, Object.assign({}, fieldConfig, { type: "password", name: name, validate: validate }), ({ input, meta }) => {
        const validationError = (((!showErrorOnBlur && meta.modified) || meta.touched) && meta.error) || (showErrorOnRender && meta.error);
        return (React.createElement("div", { className: cx(styles.field, fieldClassName), "data-testid": `${name}-field-container` },
            React.createElement(LabelCore, { name: name, label: label, required: required, inputId: inputId, tooltipLink: tooltipLink, tooltipLinkText: tooltipLinkText, tooltipText: tooltipText, tooltipDataTestId: tooltipDataTestId, tooltipLinkTarget: tooltipLinkTarget, tooltipIcon: tooltipIcon }),
            React.createElement("input", Object.assign({ id: inputId }, input, inputProps, { disabled: disabled, placeholder: placeholder, "data-testid": `${name}-password-input`, className: cx(styles.input, { invalid: !!validationError }, className) })),
            React.createElement("div", { "data-testid": `${name}-field-error-message`, className: styles.errorMessage }, validationError)));
    }));
});
PasswordInputField.displayName = 'PasswordInputField';
//# sourceMappingURL=PasswordInputField.js.map