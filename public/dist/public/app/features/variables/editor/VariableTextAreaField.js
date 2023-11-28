import { css } from '@emotion/css';
import { useId } from '@react-aria/utils';
import React from 'react';
import { Field, TextArea, useStyles2 } from '@grafana/ui';
export function VariableTextAreaField({ value, name, description, placeholder, onChange, onBlur, ariaLabel, required, width, testId, }) {
    const styles = useStyles2(getStyles);
    const id = useId();
    return (React.createElement(Field, { label: name, description: description, htmlFor: id },
        React.createElement(TextArea, { id: id, rows: 2, value: value, onChange: onChange, onBlur: onBlur, placeholder: placeholder, required: required, "aria-label": ariaLabel, cols: width, className: styles.textarea, "data-testid": testId })));
}
export function getStyles(theme) {
    return {
        textarea: css `
      white-space: pre-wrap;
      min-height: ${theme.spacing(4)};
      height: auto;
      overflow: auto;
      padding: ${theme.spacing(0.75, 1)};
      width: inherit;

      ${theme.breakpoints.down('sm')} {
        width: 100%;
      }
    `,
    };
}
//# sourceMappingURL=VariableTextAreaField.js.map