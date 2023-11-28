import { css, cx } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { autoColor } from '../Theme';
const getStyles = (theme) => {
    return {
        Divider: css `
      background: ${autoColor(theme, '#ddd')};
    `,
        DividerVertical: css `
      label: DividerVertical;
      display: inline-block;
      width: 1px;
      height: 0.9em;
      margin: 0 8px;
      vertical-align: middle;
    `,
        DividerHorizontal: css `
      label: DividerHorizontal;
      display: block;
      height: 1px;
      width: 100%;
      margin: 24px 0;
      clear: both;
      vertical-align: middle;
      position: relative;
      top: -0.06em;
    `,
    };
};
export function Divider({ className, style, type }) {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { style: style, className: cx(styles.Divider, type === 'horizontal' ? styles.DividerHorizontal : styles.DividerVertical, className) }));
}
//# sourceMappingURL=Divider.js.map