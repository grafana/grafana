import { __rest } from "tslib";
import React, { useMemo } from 'react';
import { Field } from 'react-final-form';
import { compose } from 'app/percona/shared/helpers/validatorsForm';
import { BaseCheckbox } from './Checkbox';
export const CheckboxField = React.memo((_a) => {
    var { disabled, fieldClassName, inputProps, label, name, inputId, validators, tooltipText = '', tooltipLink, tooltipLinkText, tooltipIcon, tooltipDataTestId, tooltipLinkTarget, noError } = _a, fieldConfig = __rest(_a, ["disabled", "fieldClassName", "inputProps", "label", "name", "inputId", "validators", "tooltipText", "tooltipLink", "tooltipLinkText", "tooltipIcon", "tooltipDataTestId", "tooltipLinkTarget", "noError"]);
    const validate = useMemo(() => (Array.isArray(validators) ? compose(validators) : undefined), [validators]);
    return (React.createElement(Field, Object.assign({}, fieldConfig, { type: "checkbox", name: name, validate: validate }), ({ input, meta }) => (React.createElement(BaseCheckbox, Object.assign({ className: fieldClassName, disabled: disabled, inputId: inputId }, input, inputProps, { name: name, label: label, tooltipLink: tooltipLink, tooltipLinkText: tooltipLinkText, tooltipText: tooltipText, tooltipDataTestId: tooltipDataTestId, tooltipLinkTarget: tooltipLinkTarget, tooltipIcon: tooltipIcon, touched: meta.touched, error: meta.error, noError: noError })))));
});
CheckboxField.displayName = 'CheckboxField';
//# sourceMappingURL=CheckboxField.js.map