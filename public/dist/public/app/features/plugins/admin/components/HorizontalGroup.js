import { css, cx } from '@emotion/css';
import React from 'react';
import { useTheme2 } from '@grafana/ui';
export const HorizontalGroup = ({ children, wrap, className }) => {
    const theme = useTheme2();
    const styles = getStyles(theme, wrap);
    return React.createElement("div", { className: cx(styles.container, className) }, children);
};
const getStyles = (theme, wrap) => ({
    container: css `
    display: flex;
    flex-direction: row;
    flex-wrap: ${wrap ? 'wrap' : 'no-wrap'};
    & > * {
      margin-bottom: ${theme.spacing()};
      margin-right: ${theme.spacing()};
    }
    & > *:last-child {
      margin-right: 0;
    }
  `,
});
//# sourceMappingURL=HorizontalGroup.js.map