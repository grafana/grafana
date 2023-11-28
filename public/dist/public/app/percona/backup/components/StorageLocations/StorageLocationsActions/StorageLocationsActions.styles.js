import { css } from '@emotion/css';
export const getStyles = ({ v1: { spacing } }) => ({
    actionsWrapper: css `
    display: flex;
    justify-content: space-around;
  `,
    dropdownField: css `
    display: flex;
    align-items: center;
    gap: ${spacing.sm};
  `,
});
//# sourceMappingURL=StorageLocationsActions.styles.js.map