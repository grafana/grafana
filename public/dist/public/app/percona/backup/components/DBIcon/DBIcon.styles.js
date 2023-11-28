import { css } from '@emotion/css';
export const getStyles = ({ colors }) => ({
    disabled: css `
    color: ${colors.textFaint};

    svg {
      cursor: not-allowed;
      pointer-events: none;
    }
  `,
    iconWrapper: css `
    display: flex;
    align-items: center;
    justify-content: center;
  `,
});
//# sourceMappingURL=DBIcon.styles.js.map