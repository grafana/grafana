import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export const Divider = ({ hideLine = false }) => {
    const styles = useStyles2(getStyles);
    if (hideLine) {
        return React.createElement("hr", { className: styles.dividerHideLine });
    }
    return React.createElement("hr", { className: styles.divider });
};
const getStyles = (theme) => ({
    divider: css `
    margin: ${theme.spacing(4, 0)};
  `,
    dividerHideLine: css `
    border: none;
    margin: ${theme.spacing(3, 0)};
  `,
});
//# sourceMappingURL=Divider.js.map