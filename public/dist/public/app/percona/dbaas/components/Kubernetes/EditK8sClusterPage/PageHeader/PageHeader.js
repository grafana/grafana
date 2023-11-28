import React from 'react';
import { useStyles } from '@grafana/ui/src';
import { getStyles } from './PageHeader.styles';
export const PageHeader = ({ header }) => {
    const styles = useStyles(getStyles);
    return (React.createElement("div", { className: styles.headerContainer },
        React.createElement("h2", null, header),
        React.createElement("hr", null)));
};
//# sourceMappingURL=PageHeader.js.map