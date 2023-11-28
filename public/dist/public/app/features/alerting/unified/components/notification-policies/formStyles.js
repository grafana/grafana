import { css } from '@emotion/css';
export const getFormStyles = (theme) => {
    return {
        container: css `
      align-items: center;
      display: flex;
      flex-flow: row nowrap;

      & > * + * {
        margin-left: ${theme.spacing(1)};
      }
    `,
        input: css `
      flex: 1;
    `,
        promDurationInput: css `
      max-width: ${theme.spacing(32)};
    `,
        timingFormContainer: css `
      padding: ${theme.spacing(1)};
    `,
        linkText: css `
      text-decoration: underline;
    `,
        collapse: css `
      border: none;
      background: none;
      color: ${theme.colors.text.primary};
    `,
    };
};
//# sourceMappingURL=formStyles.js.map