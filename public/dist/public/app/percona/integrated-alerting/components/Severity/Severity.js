import { cx } from '@emotion/css';
import React from 'react';
import { useTheme2 } from '@grafana/ui';
import { getStyles } from './Severity.styles';
export const Severity = ({ severity, className }) => {
    const theme = useTheme2();
    const styles = getStyles(theme, severity);
    return React.createElement("span", { className: cx(styles.severity, className) }, severity);
};
//# sourceMappingURL=Severity.js.map