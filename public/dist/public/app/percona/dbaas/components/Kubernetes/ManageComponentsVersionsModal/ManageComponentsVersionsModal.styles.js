import { css } from '@emotion/css';
export const getStyles = () => ({
    versionsWrapper: css `
    min-height: 40px;
    max-height: 200px;
  `,
    defaultWrapper: css `
    div[class$='-Menu'],
    div[class$='-grafana-select-menu'] {
      svg {
        display: none;
      }
    }
  `,
});
//# sourceMappingURL=ManageComponentsVersionsModal.styles.js.map