import { css } from '@emotion/css';
export const getStyles = (theme, center) => ({
    actionsWrapper: css `
    display: flex;
    justify-content: ${center ? 'center' : 'flex-end'};
    align-items: center;
  `,
});
//# sourceMappingURL=ExpandAndActionsCol.styles.js.map