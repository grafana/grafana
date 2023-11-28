import { css, cx } from '@emotion/css';
import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Field, FieldSet, Input, TextArea, useStyles2 } from '@grafana/ui';
import { useCorrelationsFormContext } from './correlationsFormContext';
import { getInputId } from './utils';
const getStyles = (theme) => ({
    label: css `
    max-width: ${theme.spacing(80)};
  `,
    description: css `
    max-width: ${theme.spacing(80)};
  `,
});
export const ConfigureCorrelationBasicInfoForm = () => {
    var _a;
    const { register, formState } = useFormContext();
    const styles = useStyles2(getStyles);
    const { correlation, readOnly } = useCorrelationsFormContext();
    return (React.createElement(React.Fragment, null,
        React.createElement(FieldSet, { label: "Define correlation label (Step 1 of 3)" },
            React.createElement("p", null, "Define text that will describe the correlation."),
            React.createElement("input", Object.assign({ type: "hidden" }, register('config.type'))),
            React.createElement(Field, { label: "Label", description: "This name will be used as the label for the correlation. This will show as button text, a menu item, or hover text on a link.", className: styles.label, invalid: !!formState.errors.label, error: (_a = formState.errors.label) === null || _a === void 0 ? void 0 : _a.message },
                React.createElement(Input, Object.assign({ id: getInputId('label', correlation) }, register('label', { required: { value: true, message: 'This field is required.' } }), { readOnly: readOnly, placeholder: "e.g. Tempo traces" }))),
            React.createElement(Field, { label: "Description", description: "Optional description with more information about the link", 
                // the Field component automatically adds margin to itself, so we are forced to workaround it by overriding  its styles
                className: cx(styles.description) },
                React.createElement(TextArea, Object.assign({ id: getInputId('description', correlation) }, register('description'), { readOnly: readOnly }))))));
};
//# sourceMappingURL=ConfigureCorrelationBasicInfoForm.js.map