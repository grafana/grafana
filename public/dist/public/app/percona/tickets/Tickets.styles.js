import { css } from '@emotion/css';
export const getStyles = ({ v1: { spacing, palette } }) => ({
    rowProps: css `
    cursor: pointer;
    &:hover {
      background-color: ${palette.gray15};
    }
  `,
    cellProps: css `
    background-color: transparent !important;
  `,
});
//# sourceMappingURL=Tickets.styles.js.map