import { css, keyframes } from '@emotion/css';
const bounce = keyframes `
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(0, -4px, 0);
  }
`;
export const getStyles = () => ({
    ellipsis: css `
    animation: ${bounce} 0.4s ease infinite;
    animation-direction: alternate;

    &#ellipsis-two {
      animation-delay: 0.2s;
    }

    &#ellipsis-three {
      animation-delay: 0.3s;
    }
  `,
});
//# sourceMappingURL=Ellipsis.styles.js.map