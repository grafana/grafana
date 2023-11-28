import { css } from '@emotion/css';
export const getStyles = ({ spacing, colors }) => ({
    addWrapper: css `
    display: flex;
    justify-content: flex-end;
    margin-bottom: ${spacing.sm};
  `,
    disabledRow: css `
    background-color: ${colors.dashboardBg} !important;
  `,
});
//# sourceMappingURL=ScheduledBackups.styles.js.map