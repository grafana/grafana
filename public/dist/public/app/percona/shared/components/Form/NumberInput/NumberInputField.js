import { __rest } from "tslib";
import { cx } from '@emotion/css';
import React, { useCallback, useMemo, useRef } from 'react';
import { Field } from 'react-final-form';
import { useStyles2 } from '@grafana/ui';
import { compose } from '../../../helpers/validatorsForm';
import { LabelCore } from '../LabelCore';
import { getStyles } from './NumberInput.styles';
export const NumberInputField = React.memo((_a) => {
    var { className, disabled = false, fieldClassName, inputProps, label, name, placeholder, required = false, showErrorOnBlur = false, showErrorOnRender = false, validators, inputId = `input-${name}-id`, tooltipText = '', tooltipLink, tooltipLinkText, tooltipIcon, tooltipDataTestId, tooltipLinkTarget } = _a, fieldConfig = __rest(_a, ["className", "disabled", "fieldClassName", "inputProps", "label", "name", "placeholder", "required", "showErrorOnBlur", "showErrorOnRender", "validators", "inputId", "tooltipText", "tooltipLink", "tooltipLinkText", "tooltipIcon", "tooltipDataTestId", "tooltipLinkTarget"]);
    const styles = useStyles2(getStyles);
    const validate = useMemo(() => (Array.isArray(validators) ? compose(validators) : undefined), [validators]);
    const inputRef = useRef(null);
    const dispatchChangeEvent = useCallback(() => {
        const event = new Event('change', { bubbles: true });
        if (inputRef.current) {
            inputRef.current.dispatchEvent(event);
        }
    }, [inputRef]);
    const stepUp = useCallback(() => {
        if (inputRef.current) {
            inputRef.current.stepUp();
        }
        dispatchChangeEvent();
    }, [inputRef, dispatchChangeEvent]);
    const stepDown = useCallback(() => {
        if (inputRef.current) {
            inputRef.current.stepDown();
        }
        dispatchChangeEvent();
    }, [inputRef, dispatchChangeEvent]);
    return (React.createElement(Field, Object.assign({}, fieldConfig, { type: "number", name: name, validate: validate }), ({ input, meta }) => {
        const validationError = (((!showErrorOnBlur && meta.modified) || meta.touched) && meta.error) || (showErrorOnRender && meta.error);
        return (React.createElement("div", { className: cx(styles.field, fieldClassName), "data-testid": `${name}-field-container` },
            React.createElement(LabelCore, { name: name, label: label, required: required, inputId: inputId, tooltipLink: tooltipLink, tooltipLinkText: tooltipLinkText, tooltipText: tooltipText, tooltipDataTestId: tooltipDataTestId, tooltipLinkTarget: tooltipLinkTarget, tooltipIcon: tooltipIcon }),
            React.createElement("span", { className: styles.inputWrapper },
                React.createElement("input", Object.assign({ id: inputId }, input, inputProps, { ref: inputRef, disabled: disabled, placeholder: placeholder, "data-testid": `${name}-number-input`, className: cx(styles.input, { invalid: !!validationError }, className) })),
                !disabled && (React.createElement(React.Fragment, null,
                    React.createElement("button", { type: "button", className: styles.buttonUp, onClick: stepUp },
                        React.createElement("span", { className: styles.arrowUp })),
                    React.createElement("button", { type: "button", className: styles.buttonDown, onClick: stepDown },
                        React.createElement("span", { className: styles.arrowDown }))))),
            React.createElement("div", { "data-testid": `${name}-field-error-message`, className: styles.errorMessage }, validationError)));
    }));
});
NumberInputField.displayName = 'NumberInputField';
//# sourceMappingURL=NumberInputField.js.map