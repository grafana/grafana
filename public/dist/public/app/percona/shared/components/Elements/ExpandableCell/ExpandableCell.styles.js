import { css } from '@emotion/css';
export const getStyles = () => ({
    expandableCellWrapper: css `
    display: flex;
    justify-content: space-between;
    align-items: center;

    & > span {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
});
//# sourceMappingURL=ExpandableCell.styles.js.map