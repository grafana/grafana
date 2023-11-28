import { __rest } from "tslib";
/** @jsx jsx */
import { cx } from '@emotion/css';
import { jsx } from '@emotion/react';
import { useMemo } from 'react';
import { Field } from 'react-final-form';
import { Switch, useStyles2 } from '@grafana/ui';
import { compose } from '../../../helpers/validatorsForm';
import { LabelCore } from '../LabelCore';
import { getStyles } from './Switch.styles';
export const SwitchField = (_a) => {
    var { disabled, fieldClassName, inputProps, label, name, inputId = `input-${name}-id`, validators, tooltipText = '', tooltipLink, tooltipLinkText, tooltipIcon, tooltipDataTestId, tooltipLinkTarget } = _a, fieldConfig = __rest(_a, ["disabled", "fieldClassName", "inputProps", "label", "name", "inputId", "validators", "tooltipText", "tooltipLink", "tooltipLinkText", "tooltipIcon", "tooltipDataTestId", "tooltipLinkTarget"]);
    const styles = useStyles2(getStyles);
    const validate = useMemo(() => (Array.isArray(validators) ? compose(validators) : undefined), [validators]);
    return (jsx(Field, Object.assign({}, fieldConfig, { type: "checkbox", name: name, validate: validate }), ({ input, meta }) => (jsx("div", { className: cx(styles.field, fieldClassName), "data-testid": `${name}-field-container` },
        jsx(LabelCore, { name: name, label: label, inputId: inputId, tooltipLink: tooltipLink, tooltipLinkText: tooltipLinkText, tooltipText: tooltipText, tooltipDataTestId: tooltipDataTestId, tooltipLinkTarget: tooltipLinkTarget, tooltipIcon: tooltipIcon }),
        jsx(Switch, Object.assign({ css: {} }, input, { value: input.checked, disabled: disabled, "data-testid": `${name}-switch` })),
        jsx("div", { "data-testid": `${name}-field-error-message`, className: styles.errorMessage }, meta.touched && meta.error)))));
};
//# sourceMappingURL=Switch.js.map