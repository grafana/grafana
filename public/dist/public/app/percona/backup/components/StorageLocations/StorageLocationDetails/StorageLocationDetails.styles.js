import { css } from '@emotion/css';
export const getStyles = ({ spacing }) => ({
    wrapper: css `
    display: flex;
    align-items: center;

    & > * {
      word-break: break-all;
      flex: 1 0 calc(100% / 3);

      &:not(:last-child) {
        padding-right: ${spacing.md};
      }

      &:not(:first-child) {
        padding-left: ${spacing.md};
      }
    }
  `,
});
//# sourceMappingURL=StorageLocationDetails.styles.js.map