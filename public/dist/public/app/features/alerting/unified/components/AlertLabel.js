import { css } from '@emotion/css';
import React from 'react';
import { IconButton, useStyles2 } from '@grafana/ui';
export const AlertLabel = ({ labelKey, value, operator = '=', onRemoveLabel }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.wrapper },
        labelKey,
        operator,
        value,
        !!onRemoveLabel && React.createElement(IconButton, { name: "times", size: "xs", onClick: onRemoveLabel, tooltip: "Remove label" })));
};
export const getStyles = (theme) => ({
    wrapper: css `
    padding: ${theme.spacing(0.5, 1)};
    border-radius: ${theme.shape.radius.default};
    border: solid 1px ${theme.colors.border.medium};
    font-size: ${theme.typography.bodySmall.fontSize};
    background-color: ${theme.colors.background.secondary};
    font-weight: ${theme.typography.fontWeightBold};
    color: ${theme.colors.text.primary};
    display: inline-block;
    line-height: 1.2;
  `,
});
//# sourceMappingURL=AlertLabel.js.map