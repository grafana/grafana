import { css } from '@emotion/css';
export const getStyles = (theme) => ({
    createContainer: css `
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    padding: ${theme.spacing(1)} 0;
  `,
    description: css `
    max-width: 720px;
  `,
    link: css `
    color: ${theme.colors.text.link};
  `,
});
//# sourceMappingURL=AccessRole.styles.js.map