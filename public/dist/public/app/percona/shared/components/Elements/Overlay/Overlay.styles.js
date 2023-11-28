import { css } from '@emotion/css';
export const styles = {
    getOverlayWrapper: (size) => css `
    position: relative;
    min-height: ${size * 2}px;
  `,
    spinner: css `
    left: 50%;
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 2;
  `,
    overlay: css `
    background: rgba(22, 23, 25, 0.3);
    height: 100%;
    position: absolute;
    width: 100%;
    z-index: 2;
  `,
    childrenWrapper: css `
    filter: blur(1px);
  `,
};
//# sourceMappingURL=Overlay.styles.js.map