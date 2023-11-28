import { css, cx } from '@emotion/css';
import React, { forwardRef } from 'react';
import { getInputStyles, Icon, useStyles2, getSelectStyles } from '@grafana/ui';
export const ValueContainer = forwardRef(({ children, iconName }, ref) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.container, ref: ref },
        iconName && React.createElement(Icon, { name: iconName, size: "xs" }),
        children));
});
ValueContainer.displayName = 'ValueContainer';
const getStyles = (theme) => {
    const { prefix } = getInputStyles({ theme });
    const { multiValueContainer } = getSelectStyles(theme);
    return {
        container: cx(prefix, multiValueContainer, css `
        position: relative;
        padding: ${theme.spacing(0.5, 1, 0.5, 1)};

        svg {
          margin-right: ${theme.spacing(0.5)};
        }
      `),
    };
};
//# sourceMappingURL=ValueContainer.js.map