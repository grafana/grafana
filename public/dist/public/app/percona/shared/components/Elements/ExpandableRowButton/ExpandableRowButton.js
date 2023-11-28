import React from 'react';
import { IconButton, useStyles2 } from '@grafana/ui';
import { getStyles } from './ExpandableRowButton.styles';
export const ExpandableRowButton = ({ row }) => {
    const expandedRowProps = row.getToggleRowExpandedProps ? row.getToggleRowExpandedProps() : {};
    const styles = useStyles2(getStyles);
    return (React.createElement("span", Object.assign({ className: styles.buttonWrapper }, expandedRowProps), row.isExpanded ? (React.createElement(IconButton, { "data-testid": "hide-row-details", size: "xl", name: "arrow-up", className: styles.icon, "aria-label": "Close" })) : (React.createElement(IconButton, { "data-testid": "show-row-details", size: "xl", name: "arrow-down", className: styles.icon, "aria-label": "Expand" }))));
};
//# sourceMappingURL=ExpandableRowButton.js.map