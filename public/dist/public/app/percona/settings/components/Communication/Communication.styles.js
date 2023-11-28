import { css } from '@emotion/css';
import { stylesFactory } from '@grafana/ui';
export const getStyles = stylesFactory(({ spacing }) => ({
    advancedWrapper: css `
    form {
      width: 100%;
    }
  `,
    advancedRow: css `
    display: flex;
    padding-bottom: ${spacing.md};
  `,
    advancedCol: css `
    align-items: center;
    display: flex;
    width: 180px;
  `,
}));
//# sourceMappingURL=Communication.styles.js.map