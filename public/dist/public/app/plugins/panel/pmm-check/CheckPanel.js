import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { getStyles } from './CheckPanel.styles';
import { Failed } from './components';
export const CheckPanel = () => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.panel, "data-testid": "db-check-panel-home" },
        React.createElement(Failed, null)));
};
//# sourceMappingURL=CheckPanel.js.map