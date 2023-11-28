import { css, cx } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export const DetailsField = ({ className, label, horizontal, children, childrenWrapperClassName, }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: cx(styles.field, horizontal ? styles.fieldHorizontal : styles.fieldVertical, className) },
        React.createElement("div", null, label),
        React.createElement("div", { className: childrenWrapperClassName }, children)));
};
const getStyles = (theme) => ({
    fieldHorizontal: css `
    flex-direction: row;
    ${theme.breakpoints.down('md')} {
      flex-direction: column;
    }
  `,
    fieldVertical: css `
    flex-direction: column;
  `,
    field: css `
    display: flex;
    margin: ${theme.spacing(2)} 0;

    & > div:first-child {
      width: 110px;
      padding-right: ${theme.spacing(1)};
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.fontWeightBold};
      line-height: 1.8;
    }
    & > div:nth-child(2) {
      flex: 1;
      color: ${theme.colors.text.secondary};
    }
  `,
});
//# sourceMappingURL=DetailsField.js.map