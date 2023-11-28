import { css } from '@emotion/css';
export const getStyles = ({ spacing }) => ({
    clusterStatusWrapper: css `
    align-items: center;
    display: flex;
    justify-content: center;
    padding: ${spacing.xs} 0;

    a > span {
      cursor: pointer;
    }
  `,
});
//# sourceMappingURL=KubernetesOperatorStatus.styles.js.map