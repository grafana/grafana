import { css } from '@emotion/css';
export const getStyles = ({ v1: { spacing } }) => ({
    sshKeyWrapper: css `
    display: flex;
    flex-direction: column;
  `,
    textarea: css `
    margin: ${spacing.md} 0;
    min-height: 150px;
  `,
});
//# sourceMappingURL=SSHKey.styles.js.map