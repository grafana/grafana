import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export const EmptyQueryListBanner = () => {
    const styles = useStyles2(getStyles);
    return React.createElement("div", { className: styles.noResult }, "No playlist found!");
};
const getStyles = (theme) => {
    return {
        noResult: css `
      padding: ${theme.spacing(2)};
      background: ${theme.colors.secondary.main};
      font-style: italic;
      margin-top: ${theme.spacing(2)};
    `,
    };
};
//# sourceMappingURL=EmptyQueryListBanner.js.map