import { css } from '@emotion/css';
export const getStyles = ({ v1: { spacing } }) => ({
    emailForm: css `
    margin-top: ${spacing.md};
  `,
    authRadioGroup: css `
    & input[type='radio'] + label {
      white-space: nowrap;
    }
  `,
});
//# sourceMappingURL=Email.styles.js.map