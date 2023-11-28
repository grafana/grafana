import { __rest } from "tslib";
import { cx } from '@emotion/css';
import React, { useMemo } from 'react';
import { Field } from 'react-final-form';
import { Icon, Switch, Tooltip, useStyles } from '@grafana/ui';
import { compose } from 'app/percona/shared/helpers/validatorsForm';
import { getStyles } from './Switch.styles';
export const SwitchField = (_a) => {
    var { disabled, fieldClassName, inputProps, label, name, validators, tooltip, tooltipIcon = 'info-circle' } = _a, fieldConfig = __rest(_a, ["disabled", "fieldClassName", "inputProps", "label", "name", "validators", "tooltip", "tooltipIcon"]);
    const styles = useStyles(getStyles);
    const inputId = `input-${name}-id`;
    const validate = useMemo(() => (Array.isArray(validators) ? compose(validators) : undefined), [validators]);
    return (React.createElement(Field, Object.assign({}, fieldConfig, { type: "checkbox", name: name, validate: validate }), ({ input, meta }) => (React.createElement("div", { className: cx(styles.field, fieldClassName), "data-testid": `${name}-field-container` },
        React.createElement("div", { className: styles.fieldWithLabelWrapper },
            React.createElement(Switch, Object.assign({}, input, { value: input.checked, disabled: disabled, "data-testid": `${name}-switch` })),
            label && (React.createElement("div", { className: styles.labelWrapper },
                React.createElement("label", { className: styles.label, htmlFor: inputId, "data-testid": `${name}-field-label` }, label),
                tooltip && (React.createElement(Tooltip, { content: React.createElement("span", null, tooltip), "data-testid": `${name}-field-tooltip` },
                    React.createElement(Icon, { name: tooltipIcon })))))),
        React.createElement("div", { "data-testid": `${name}-field-error-message`, className: styles.errorMessage }, meta.touched && meta.error)))));
};
//# sourceMappingURL=Switch.js.map