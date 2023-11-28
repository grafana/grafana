import React from 'react';
import { Alert, useStyles } from '@grafana/ui/src';
import { getStyles } from './UnsafeConfigurationWarning.styles';
export const UnsafeConfigurationWarning = () => {
    const styles = useStyles(getStyles);
    return (React.createElement(Alert, { title: "", className: styles.alertMessageWrapper, severity: "info", "data-testid": "pmm-server-url-warning" }, "Unsafe configuration, not for production use"));
};
//# sourceMappingURL=UnsafeConfigurationWarning.js.map