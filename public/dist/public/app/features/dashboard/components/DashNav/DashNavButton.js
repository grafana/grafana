// Libraries
import { css } from '@emotion/css';
import React from 'react';
import { IconButton, useStyles2 } from '@grafana/ui';
export const DashNavButton = ({ icon, iconType, iconSize, tooltip, onClick, children }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.noBorderContainer },
        icon && (React.createElement(IconButton, { name: icon, size: iconSize, iconType: iconType, tooltip: tooltip, tooltipPlacement: "bottom", onClick: onClick })),
        children));
};
const getStyles = (theme) => ({
    noBorderContainer: css `
    padding: 0 ${theme.spacing(0.5)};
    display: flex;
  `,
});
//# sourceMappingURL=DashNavButton.js.map