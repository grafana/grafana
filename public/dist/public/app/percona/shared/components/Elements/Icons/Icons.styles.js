import { css } from '@emotion/css';
export const getStyles = ({ isLight }) => {
    const iconsFill = isLight ? 'black' : 'rgba(255, 255, 255, 0.8)';
    return {
        icon: css `
      path,
      polygon,
      circle {
        fill: ${iconsFill};
      }
    `,
    };
};
//# sourceMappingURL=Icons.styles.js.map