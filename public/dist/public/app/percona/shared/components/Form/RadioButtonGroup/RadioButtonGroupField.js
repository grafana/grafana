import { __rest } from "tslib";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { cx } from '@emotion/css';
import React, { useCallback, useMemo } from 'react';
import { Field } from 'react-final-form';
import { Icon, useStyles2 } from '@grafana/ui';
import { compose } from 'app/percona/shared/helpers/validatorsForm';
import { LabelCore } from '../LabelCore';
import { RadioButton } from './RadioButton';
import { getStyles } from './RadioButtonGroup.styles';
export function RadioButtonGroupField(_a) {
    var { className, disabled, fullWidth = false, inputProps, label, name, inputId = `input-${name}-id`, options, required = false, showErrorOnBlur = false, size = 'md', validators, tooltipText = '', tooltipLink, tooltipLinkText, tooltipIcon, tooltipDataTestId, tooltipLinkTarget } = _a, fieldConfig = __rest(_a, ["className", "disabled", "fullWidth", "inputProps", "label", "name", "inputId", "options", "required", "showErrorOnBlur", "size", "validators", "tooltipText", "tooltipLink", "tooltipLinkText", "tooltipIcon", "tooltipDataTestId", "tooltipLinkTarget"]);
    const handleOnChange = useCallback((option, input) => () => {
        if (option.disabled || disabled) {
            return;
        }
        input.onChange(option.value);
    }, [disabled]);
    const styles = useStyles2(getStyles);
    const validate = useMemo(() => (Array.isArray(validators) ? compose(validators) : undefined), [validators]);
    return (React.createElement(Field, Object.assign({}, fieldConfig, { type: "text", name: name, validate: validate }), ({ input, meta }) => {
        const validationError = ((!showErrorOnBlur && meta.modified) || meta.touched) && meta.error;
        return (React.createElement("div", { className: cx(styles.wrapper, className) },
            React.createElement(LabelCore, { name: name, label: label, required: required, inputId: inputId, tooltipLink: tooltipLink, tooltipLinkText: tooltipLinkText, tooltipText: tooltipText, tooltipDataTestId: tooltipDataTestId, tooltipLinkTarget: tooltipLinkTarget, tooltipIcon: tooltipIcon }),
            React.createElement("input", Object.assign({ id: inputId }, input, { "data-testid": `${name}-radio-state`, className: styles.input })),
            React.createElement("div", { className: styles.buttonContainer }, options.map((o) => (React.createElement(RadioButton, { checked: input.value === o.value, disabled: o.disabled || disabled, fullWidth: fullWidth, inputProps: inputProps, key: o.label, name: name, onChange: handleOnChange(o, input), size: size },
                o.icon && React.createElement(Icon, { name: o.icon, className: styles.icon }),
                o.label)))),
            React.createElement("div", { "data-testid": `${name}-field-error-message`, className: styles.errorMessage }, validationError)));
    }));
}
RadioButtonGroupField.displayName = 'RadioButtonGroupField';
//# sourceMappingURL=RadioButtonGroupField.js.map