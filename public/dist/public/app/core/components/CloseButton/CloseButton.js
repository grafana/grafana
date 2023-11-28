import { css } from '@emotion/css';
import React from 'react';
import { IconButton, useStyles2 } from '@grafana/ui';
export const CloseButton = ({ onClick, 'aria-label': ariaLabel, style }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement(IconButton, { "aria-label": ariaLabel !== null && ariaLabel !== void 0 ? ariaLabel : 'Close', className: styles, name: "times", onClick: onClick, style: style, tooltip: "Close" }));
};
const getStyles = (theme) => css `
  position: absolute;
  right: ${theme.spacing(0.5)};
  top: ${theme.spacing(1)};
`;
//# sourceMappingURL=CloseButton.js.map