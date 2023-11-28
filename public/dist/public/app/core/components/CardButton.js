import { __rest } from "tslib";
import { css } from '@emotion/css';
import React from 'react';
import { Icon, useStyles2 } from '@grafana/ui';
export const CardButton = React.forwardRef((_a, ref) => {
    var { icon, children, onClick } = _a, restProps = __rest(_a, ["icon", "children", "onClick"]);
    const styles = useStyles2(getStyles);
    return (React.createElement("button", Object.assign({}, restProps, { className: styles.action, onClick: onClick }),
        React.createElement(Icon, { name: icon, size: "xl" }),
        children));
});
CardButton.displayName = 'CardButton';
const getStyles = (theme) => {
    return {
        action: css `
      display: flex;
      flex-direction: column;
      height: 100%;

      justify-self: center;
      cursor: pointer;
      background: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.radius.default};
      color: ${theme.colors.text.primary};
      border: unset;
      width: 100%;
      display: flex;

      justify-content: center;
      align-items: center;
      text-align: center;

      &:hover {
        background: ${theme.colors.emphasize(theme.colors.background.secondary)};
      }
    `,
    };
};
//# sourceMappingURL=CardButton.js.map