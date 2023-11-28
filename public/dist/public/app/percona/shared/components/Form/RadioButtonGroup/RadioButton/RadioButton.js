import React, { useMemo, useRef } from 'react';
import { useStyles2 } from '@grafana/ui';
import { generateId } from 'app/percona/shared/helpers/utils';
import { getStylesFn } from './RadioButton.styles';
export const RadioButton = ({ checked = false, children, disabled = false, fullWidth, inputProps, name, onChange, size = 'md', }) => {
    const getStyles = useMemo(() => getStylesFn(size, fullWidth), [size, fullWidth]);
    const styles = useStyles2(getStyles);
    const id = useMemo(generateId, [generateId]);
    const inputId = useRef(`radio-btn-${id}`);
    return (React.createElement(React.Fragment, null,
        React.createElement("input", Object.assign({ id: inputId.current }, inputProps, { type: "radio", "data-testid": `${name}-radio-button`, className: styles.radio, onChange: onChange, disabled: disabled, checked: checked, name: name })),
        React.createElement("label", { className: styles.radioLabel, htmlFor: inputId.current }, children)));
};
RadioButton.displayName = 'RadioButton';
//# sourceMappingURL=RadioButton.js.map