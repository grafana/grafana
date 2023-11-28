import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export const EmptyArea = ({ children }) => {
    const styles = useStyles2(getStyles);
    return React.createElement("div", { className: styles.container }, children);
};
const getStyles = (theme) => {
    return {
        container: css `
      background-color: ${theme.colors.background.secondary};
      color: ${theme.colors.text.secondary};
      padding: ${theme.spacing(4)};
      text-align: center;
    `,
    };
};
//# sourceMappingURL=EmptyArea.js.map