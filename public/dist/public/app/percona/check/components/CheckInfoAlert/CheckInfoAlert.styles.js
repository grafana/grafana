import { css } from '@emotion/css';
export const getStyles = ({ colors }) => ({
    link: css `
    color: ${colors.text.link};
    &:hover {
      color: ${colors.text.primary};
    }
  `,
    content: css `
    max-width: 80%;
  `,
});
//# sourceMappingURL=CheckInfoAlert.styles.js.map