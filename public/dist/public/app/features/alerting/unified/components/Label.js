import { css } from '@emotion/css';
import React from 'react';
import tinycolor2 from 'tinycolor2';
import { Stack } from '@grafana/experimental';
import { Icon, useStyles2 } from '@grafana/ui';
// TODO allow customization with color prop
const Label = ({ label, value, icon, color, size = 'md' }) => {
    const styles = useStyles2(getStyles, color, size);
    return (React.createElement("div", { className: styles.wrapper, role: "listitem" },
        React.createElement(Stack, { direction: "row", gap: 0, alignItems: "stretch", wrap: false },
            React.createElement("div", { className: styles.label },
                React.createElement(Stack, { direction: "row", gap: 0.5, alignItems: "center" },
                    icon && React.createElement(Icon, { name: icon }),
                    " ", label !== null && label !== void 0 ? label : '')),
            React.createElement("div", { className: styles.value }, value))));
};
const getStyles = (theme, color, size) => {
    const backgroundColor = color !== null && color !== void 0 ? color : theme.colors.secondary.main;
    const borderColor = theme.isDark
        ? tinycolor2(backgroundColor).lighten(5).toString()
        : tinycolor2(backgroundColor).darken(5).toString();
    const valueBackgroundColor = theme.isDark
        ? tinycolor2(backgroundColor).darken(5).toString()
        : tinycolor2(backgroundColor).lighten(5).toString();
    const fontColor = color
        ? tinycolor2.mostReadable(backgroundColor, ['#000', '#fff']).toString()
        : theme.colors.text.primary;
    const padding = size === 'md' ? `${theme.spacing(0.33)} ${theme.spacing(1)}` : `${theme.spacing(0.2)} ${theme.spacing(0.6)}`;
    return {
        wrapper: css `
      color: ${fontColor};
      font-size: ${theme.typography.bodySmall.fontSize};

      border-radius: ${theme.shape.borderRadius(2)};
    `,
        label: css `
      display: flex;
      align-items: center;
      color: inherit;

      padding: ${padding};
      background: ${backgroundColor};

      border: solid 1px ${borderColor};
      border-top-left-radius: ${theme.shape.borderRadius(2)};
      border-bottom-left-radius: ${theme.shape.borderRadius(2)};
    `,
        value: css `
      color: inherit;
      padding: ${padding};
      background: ${valueBackgroundColor};

      border: solid 1px ${borderColor};
      border-left: none;
      border-top-right-radius: ${theme.shape.borderRadius(2)};
      border-bottom-right-radius: ${theme.shape.borderRadius(2)};
    `,
    };
};
export { Label };
//# sourceMappingURL=Label.js.map