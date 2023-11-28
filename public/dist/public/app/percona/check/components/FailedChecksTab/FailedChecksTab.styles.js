import { css } from '@emotion/css';
export const getStyles = ({ v1: { spacing }, colors }) => ({
    spinner: css `
    display: flex;
    height: 10em;
    align-items: center;
    justify-content: center;
  `,
    row: css `
    cursor: pointer;
    &:hover {
      background: ${colors.action.hover};
    }
  `,
    cell: css `
    background: transparent !important;
  `,
    contentWrapper: css `
    padding: ${spacing.sm};
  `,
});
//# sourceMappingURL=FailedChecksTab.styles.js.map