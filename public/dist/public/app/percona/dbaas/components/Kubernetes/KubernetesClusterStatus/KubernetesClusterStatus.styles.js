import { css } from '@emotion/css';
export const getStyles = ({ v1 }) => ({
    clusterStatusWrapper: css `
    align-items: center;
    display: flex;
    justify-content: center;
    padding: ${v1.spacing.xs} 0;

    a > span {
      cursor: pointer;
    }
  `,
});
//# sourceMappingURL=KubernetesClusterStatus.styles.js.map