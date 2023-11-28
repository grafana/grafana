import { css } from '@emotion/css';
export const getStyles = (theme) => ({
    emptyBlockWrapper: css `
    display: flex;
    width: 100%;
    height: 160px;
    justify-content: center;
    align-items: center;
    border-radius: ${theme.shape.borderRadius(2)};
    background: ${theme.colors.background.secondary};
  `,
});
//# sourceMappingURL=EmptyBlock.styles.js.map