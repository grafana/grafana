import { css } from '@emotion/css';
export const getStyles = (theme, hidden) => {
    return {
        color: hidden &&
            css `
        &,
        &:hover,
        label,
        a {
          color: ${hidden ? theme.colors.text.disabled : theme.colors.text.primary};
        }
      `,
    };
};
//# sourceMappingURL=styles.js.map