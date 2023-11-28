import { css } from '@emotion/css';
export const getStyles = ({ spacing }) => ({
    fieldWrapper: css `
    position: relative;
  `,
    smallPassword: css `
    margin-right: ${spacing.sm};
  `,
    lock: css `
    cursor: pointer;
  `,
    fullLock: css `
    position: absolute;
    right: 7px;
    top: 34px;
  `,
});
//# sourceMappingURL=SecretToggler.styles.js.map