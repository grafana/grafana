import { css } from '@emotion/css';
export const getStyles = ({ v1: { spacing } }) => ({
    actionsWrapper: css `
    display: flex;
    justify-content: space-around;
    align-items: center;
  `,
    dropdownField: css `
    display: flex;
    align-items: center;
    gap: ${spacing.sm};
  `,
});
//# sourceMappingURL=BackupInventoryActions.styles.js.map