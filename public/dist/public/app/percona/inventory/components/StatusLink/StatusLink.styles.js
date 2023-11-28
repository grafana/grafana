import { css } from '@emotion/css';
export const getStyles = ({ visualization }, allAgentsOk) => ({
    link: css `
    text-decoration: underline;
    color: ${allAgentsOk ? visualization.getColorByName('green') : visualization.getColorByName('red')};
  `,
});
//# sourceMappingURL=StatusLink.styles.js.map