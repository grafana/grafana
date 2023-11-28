import { css } from '@emotion/css';
export const getStyles = ({ spacing }) => ({
    detailsWrapper: css `
    display: flex;

    & > span {
      flex: 0 1 33%;
      word-break: break-all;

      &:first-child {
        margin-right: ${spacing.sm};
      }
    }
  `,
    detailLabel: css `
    margin-right: ${spacing.md};
  `,
});
//# sourceMappingURL=BackupInventoryDetails.styles.js.map