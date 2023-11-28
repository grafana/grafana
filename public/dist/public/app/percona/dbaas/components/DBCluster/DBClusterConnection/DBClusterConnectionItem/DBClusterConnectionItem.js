import React from 'react';
import { useStyles } from '@grafana/ui';
import { getStyles } from './DBClusterConnectionItem.styles';
export const DBClusterConnectionItem = ({ label, value, dataTestId }) => {
    const styles = useStyles(getStyles);
    return (React.createElement("div", { className: styles.connectionItemWrapper, "data-testid": dataTestId },
        React.createElement("span", { className: styles.connectionItemLabel },
            label,
            ":"),
        React.createElement("span", { className: styles.connectionItemValue }, value)));
};
//# sourceMappingURL=DBClusterConnectionItem.js.map