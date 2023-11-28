import { css } from '@emotion/css';
export const getStyles = ({ spacing }) => ({
    optionsWrapper: css `
    margin-top: ${spacing(3)};
    max-width: 720px;
  `,
    collapsableSection: css `
    max-width: 170px;
    margin: ${spacing(6)} 0 ${spacing(3)} 0;
  `,
    switchOptionsWrapper: css `
    fieldset {
      margin-top: 0;
      margin-bottom: 0;
      legend:first-child {
        margin-bottom: ${spacing(2)};
      }
    }
  `,
});
//# sourceMappingURL=EditDBClusterPage.styles.js.map