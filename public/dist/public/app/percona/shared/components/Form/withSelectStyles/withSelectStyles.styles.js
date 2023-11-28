import { css } from '@emotion/css';
export const getStyles = ({ spacing }) => ({
    select: css `
    margin-bottom: ${spacing.xl};
    & > div {
      padding: 7px 8px;
    }
  `,
});
//# sourceMappingURL=withSelectStyles.styles.js.map