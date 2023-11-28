import { css } from '@emotion/css';
export const getStyles = ({ spacing, typography }) => ({
    detailsWrapper: css `
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    margin-top: -${spacing.md};

    & > * {
      flex: 1 0 50%;
      margin-top: ${spacing.md};
    }
  `,
    detailLabel: css `
    margin-right: ${spacing.md};
    font-weight: ${typography.weight.semibold};
  `,
});
//# sourceMappingURL=ScheduledBackupsDetails.styles.js.map