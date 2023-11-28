import React from 'react';
import { useTheme } from '@grafana/ui';
import { getStyles } from './TabsVertical.styles';
export const TabsVertical = ({ children, className, dataTestId }) => {
    const theme = useTheme();
    const styles = getStyles(theme);
    return (React.createElement("div", { className: className },
        React.createElement("ul", { "data-testid": dataTestId, className: styles.tabs }, children)));
};
//# sourceMappingURL=TabsVertical.js.map