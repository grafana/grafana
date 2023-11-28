import { __rest } from "tslib";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { cx } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Field } from 'react-final-form';
import { useStyles } from '@grafana/ui';
import { CheckboxField } from 'app/percona/shared/components/Elements/Checkbox';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { Label } from '../Label';
import { getStyles } from './MultiCheckboxField.styles';
const { compose } = validators;
export const MultiCheckboxField = React.memo((_a) => {
    var { className, disabled = false, label, name, required = false, showErrorOnBlur = false, initialOptions, validators, recommendedOptions = [], recommendedLabel } = _a, fieldConfig = __rest(_a, ["className", "disabled", "label", "name", "required", "showErrorOnBlur", "initialOptions", "validators", "recommendedOptions", "recommendedLabel"]);
    const styles = useStyles(getStyles);
    const [selectedOptions, setSelectedOptions] = useState(initialOptions);
    const validate = useMemo(() => (Array.isArray(validators) ? compose(validators) : undefined), [validators]);
    const onChangeOption = useCallback((input) => ({ target }) => {
        const newSelectedOptions = selectedOptions.map((option) => option.name === target.name ? Object.assign(Object.assign({}, option), { value: target.checked }) : option);
        input.onChange(newSelectedOptions);
        setSelectedOptions(newSelectedOptions);
    }, [selectedOptions]);
    const onBlurOption = useCallback((input) => (event) => input.onBlur(event), []);
    useEffect(() => setSelectedOptions(initialOptions), [initialOptions]);
    return (React.createElement(Field, Object.assign({}, fieldConfig, { name: name, initialValue: selectedOptions, validate: validate }), ({ input, meta }) => {
        const validationError = meta.error && typeof meta.error === 'string' ? meta.error : undefined;
        return (React.createElement("div", { className: styles.field, "data-testid": `${name}-field-container` },
            label && React.createElement(Label, { label: `${label}${required ? ' *' : ''}`, dataTestId: `${name}-field-label` }),
            React.createElement("div", { className: cx(styles.getOptionsWrapperStyles(!!validationError), className), "data-testid": `${name}-options` }, selectedOptions.map(({ name, label, value }) => (React.createElement("div", { className: styles.optionWrapper, key: name, "data-testid": `${name}-option` },
                React.createElement("span", { className: styles.optionLabel }, label),
                recommendedOptions.some((r) => r.name === name) && (React.createElement("span", { className: styles.recommendedLabel }, recommendedLabel)),
                React.createElement(CheckboxField, { name: name, inputProps: {
                        checked: value,
                        onChange: onChangeOption(input),
                        onBlur: onBlurOption(input),
                    } }))))),
            React.createElement("div", { "data-testid": `${name}-field-error-message`, className: styles.errorMessage }, validationError)));
    }));
});
MultiCheckboxField.displayName = 'MultiCheckboxField';
//# sourceMappingURL=MultiCheckboxField.js.map