import { __rest } from "tslib";
import { cx } from '@emotion/css';
import React, { useMemo } from 'react';
import { Field } from 'react-final-form';
import { useStyles2 } from '@grafana/ui';
import { compose } from 'app/percona/shared/helpers/validatorsForm';
import { LabelCore } from '../LabelCore';
import { getStyles } from './TextareaInput.styles';
export const TextareaInputField = React.memo((_a) => {
    var { className, disabled = false, fieldClassName, inputProps, label, name, inputId = `input-${name}-id`, placeholder, required = false, resize = 'vertical', rows = 5, showErrorOnBlur = false, showErrorOnRender = false, validators, tooltipText = '', tooltipLink, tooltipLinkText, tooltipIcon, tooltipDataTestId, tooltipLinkTarget } = _a, fieldConfig = __rest(_a, ["className", "disabled", "fieldClassName", "inputProps", "label", "name", "inputId", "placeholder", "required", "resize", "rows", "showErrorOnBlur", "showErrorOnRender", "validators", "tooltipText", "tooltipLink", "tooltipLinkText", "tooltipIcon", "tooltipDataTestId", "tooltipLinkTarget"]);
    const styles = useStyles2(getStyles);
    const validate = useMemo(() => (Array.isArray(validators) ? compose(validators) : undefined), [validators]);
    return (React.createElement(Field, Object.assign({}, fieldConfig, { name: name, validate: validate }), ({ input, meta }) => {
        const validationError = (((!showErrorOnBlur && meta.modified) || meta.touched) && meta.error) || (showErrorOnRender && meta.error);
        return (React.createElement("div", { className: cx(styles.field, fieldClassName), "data-testid": `${name}-field-container` },
            React.createElement(LabelCore, { name: name, label: label, required: required, inputId: inputId, tooltipLink: tooltipLink, tooltipLinkText: tooltipLinkText, tooltipText: tooltipText, tooltipDataTestId: tooltipDataTestId, tooltipLinkTarget: tooltipLinkTarget, tooltipIcon: tooltipIcon }),
            React.createElement("textarea", Object.assign({ id: inputId }, input, inputProps, { rows: rows, disabled: disabled, placeholder: placeholder, "data-testid": `${name}-textarea-input`, className: cx(styles.input, { invalid: !!validationError, [resize]: resize !== 'both' }, className) })),
            React.createElement("div", { "data-testid": `${name}-field-error-message`, className: styles.errorMessage }, validationError)));
    }));
});
TextareaInputField.displayName = 'TextareaInputField';
//# sourceMappingURL=TextareaInputField.js.map