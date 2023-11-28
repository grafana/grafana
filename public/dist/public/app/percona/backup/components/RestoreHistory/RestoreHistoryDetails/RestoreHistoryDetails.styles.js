import { css } from '@emotion/css';
export const getStyles = ({ spacing, typography }) => ({
    detailsWrapper: css `
    display: flex;

    & > span {
      flex: 1 1 33.33%;
    }
  `,
    detailLabel: css `
    margin-right: ${spacing.md};
    font-weight: ${typography.weight.semibold};
  `,
    pitrContainer: css `
    display: flex;
  `,
});
//# sourceMappingURL=RestoreHistoryDetails.styles.js.map