import { cx, css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export const Well = ({ children, className }) => {
    const styles = useStyles2(getStyles);
    return React.createElement("div", { className: cx(styles.wrapper, className) }, children);
};
export const getStyles = (theme) => ({
    wrapper: css `
    background-color: ${theme.components.panel.background};
    border: solid 1px ${theme.components.input.borderColor};
    border-radius: ${theme.shape.radius.default};
    padding: ${theme.spacing(0.5, 1)};
    font-family: ${theme.typography.fontFamilyMonospace};
  `,
});
//# sourceMappingURL=Well.js.map