import { css } from '@emotion/css';
export const getStyles = ({ spacing }) => ({
    nameWrapper: css `
    display: flex;
    justify-content: space-between;
    align-items: center;

    & > span {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
    addWrapper: css `
    display: flex;
    justify-content: flex-end;
    margin-bottom: ${spacing.sm};
  `,
});
//# sourceMappingURL=StorageLocations.styles.js.map