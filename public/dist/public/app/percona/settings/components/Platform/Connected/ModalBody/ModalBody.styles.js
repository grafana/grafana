import { css } from '@emotion/css';
export const getStyles = ({ v1: { colors } }) => ({
    link: css `
    color: ${colors.linkExternal};
    &:hover {
      color: ${colors.textBlue};
    }
  `,
});
//# sourceMappingURL=ModalBody.styles.js.map