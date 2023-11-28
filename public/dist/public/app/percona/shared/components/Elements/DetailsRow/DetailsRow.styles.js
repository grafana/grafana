import { css } from '@emotion/css';
export const getStyles = ({ spacing }) => ({
    rowContentWrapper: css `
    display: flex;
    flex-direction: column;
  `,
    fullRowContent: css `
    flex-basis: 100%;
    max-width: 100%;
  `,
    row: css `
    display: flex;
    flex-wrap: wrap;
    gap: ${spacing(4)};
  `,
});
//# sourceMappingURL=DetailsRow.styles.js.map