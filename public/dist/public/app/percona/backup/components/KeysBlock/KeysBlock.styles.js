import { css } from '@emotion/css';
export const getStyles = ({ typography }) => ({
    keysWrapper: css `
    display: flex;
    flex-direction: column;
    justify-content: center;
  `,
    keyLabel: css `
    display: inline-block;
    width: 85px;
    font-weight: ${typography.weight.semibold};
  `,
    secretTogglerWrapper: css `
    display: inline-block;
  `,
});
//# sourceMappingURL=KeysBlock.styles.js.map