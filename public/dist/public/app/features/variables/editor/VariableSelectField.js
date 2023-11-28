import { css } from '@emotion/css';
import React, { useId } from 'react';
import { Field, Select, useStyles2 } from '@grafana/ui';
export function VariableSelectField({ name, description, value, options, onChange, testId, width, }) {
    const styles = useStyles2(getStyles);
    const uniqueId = useId();
    const inputId = `variable-select-input-${name}-${uniqueId}`;
    return (React.createElement(Field, { label: name, description: description, htmlFor: inputId },
        React.createElement("div", { "data-testid": testId },
            React.createElement(Select, { inputId: inputId, onChange: onChange, value: value, width: width !== null && width !== void 0 ? width : 30, options: options, className: styles.selectContainer }))));
}
function getStyles(theme) {
    return {
        selectContainer: css `
      margin-right: ${theme.spacing(0.5)};
    `,
    };
}
//# sourceMappingURL=VariableSelectField.js.map