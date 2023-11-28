import { css } from '@emotion/css';
export const getStyles = ({ colors }) => ({
    link: css `
    color: ${colors.linkExternal};
    &:hover {
      color: ${colors.textBlue};
    }
  `,
    unauthorized: css `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translateX(-50%) translateY(-50%);
  `,
});
//# sourceMappingURL=FeatureLoader.styles.js.map