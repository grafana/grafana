import { css } from '@emotion/css';
export const getStyles = ({ spacing }) => ({
    line: css `
    display: flex;
    gap: ${spacing.lg};
    > div {
      flex: 1 0;
    }
  `,
    basicOptions: css `
    margin-bottom: 25px;
  `,
});
//# sourceMappingURL=DBClusterBasicOptions.styles.js.map