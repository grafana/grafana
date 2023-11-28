import { __rest } from "tslib";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { cx } from '@emotion/css';
import React, { useMemo } from 'react';
import { Field } from 'react-final-form';
import { AsyncSelect, useStyles2 } from '@grafana/ui';
import { compose } from 'app/percona/shared/helpers/validatorsForm';
import { LabelCore } from '../LabelCore';
import { getStyles } from './AsyncSelectFieldCore.styles';
export const AsyncSelectFieldCore = (_a) => {
    var { label, name, required, inputId, tooltipLink, tooltipText, tooltipLinkText, tooltipDataTestId, tooltipIcon, tooltipLinkTarget, validators, fieldClassName, className, showErrorOnBlur, onChange, onChangeGenerator, getValueForValidators } = _a, fieldConfig = __rest(_a, ["label", "name", "required", "inputId", "tooltipLink", "tooltipText", "tooltipLinkText", "tooltipDataTestId", "tooltipIcon", "tooltipLinkTarget", "validators", "fieldClassName", "className", "showErrorOnBlur", "onChange", "onChangeGenerator", "getValueForValidators"]);
    const styles = useStyles2(getStyles);
    const getValue = useMemo(() => getValueForValidators || ((incomingValue) => incomingValue === null || incomingValue === void 0 ? void 0 : incomingValue.value), [getValueForValidators]);
    const validate = useMemo(() => (Array.isArray(validators) ? compose(validators, getValue) : undefined), [validators, getValue]);
    return (React.createElement(Field, Object.assign({}, fieldConfig, { name: name, validate: validate }), ({ input, meta }) => {
        const validationError = ((!showErrorOnBlur && meta.modified) || meta.touched) && meta.error;
        return (React.createElement("div", { className: cx(styles.field, fieldClassName), "data-testid": `${name}-field-container` },
            !!label && (React.createElement(LabelCore, { name: name, label: label, required: required, inputId: inputId, tooltipLink: tooltipLink, tooltipLinkText: tooltipLinkText, tooltipText: tooltipText, tooltipDataTestId: tooltipDataTestId, tooltipLinkTarget: tooltipLinkTarget, tooltipIcon: tooltipIcon })),
            React.createElement(AsyncSelect, Object.assign({}, fieldConfig, { className: cx({ invalid: !!validationError }, className) }, input, { onChange: (value, actionMeta) => {
                    if (onChangeGenerator) {
                        onChangeGenerator(input);
                    }
                    else if (onChange) {
                        onChange(value, actionMeta);
                    }
                    input.onChange(value);
                } })),
            React.createElement("div", { "data-testid": `${name}-field-error-message`, className: styles.errorMessage }, validationError)));
    }));
};
//# sourceMappingURL=AsyncSelectFieldCore.js.map