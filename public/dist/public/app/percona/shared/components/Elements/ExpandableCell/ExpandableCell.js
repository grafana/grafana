import React from 'react';
import { IconButton, useStyles } from '@grafana/ui';
import { getStyles } from './ExpandableCell.styles';
export const ExpandableCell = ({ row, value, collapsedIconName = 'arrow-down', expandedIconName = 'arrow-up', }) => {
    const styles = useStyles(getStyles);
    const restProps = row.getToggleRowExpandedProps ? row.getToggleRowExpandedProps() : {};
    return (React.createElement("div", Object.assign({ className: styles.expandableCellWrapper }, restProps),
        React.createElement("span", null, value),
        row.isExpanded ? (React.createElement(IconButton, { tooltip: "Hide details", "data-testid": "hide-details", size: "xl", name: expandedIconName })) : (React.createElement(IconButton, { tooltip: "Show details", "data-testid": "show-details", size: "xl", name: collapsedIconName }))));
};
//# sourceMappingURL=ExpandableCell.js.map