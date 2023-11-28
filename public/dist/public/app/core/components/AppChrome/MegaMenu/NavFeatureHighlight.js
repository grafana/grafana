import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export const NavFeatureHighlight = ({ children }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", null,
        children,
        React.createElement("span", { className: styles.highlight })));
};
const getStyles = (theme) => {
    return {
        highlight: css `
      background-color: ${theme.colors.success.main};
      border-radius: ${theme.shape.radius.circle};
      width: 6px;
      height: 6px;
      display: inline-block;
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
    `,
    };
};
//# sourceMappingURL=NavFeatureHighlight.js.map