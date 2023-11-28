import { css } from '@emotion/css';
export const getStyles = ({ v1, typography, colors }) => ({
    clusterStatusWrapper: css `
    align-items: flex-end;
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin: ${v1.spacing.sm};
    min-width: 125px;
    padding: ${v1.spacing.xs} 0;
    position: relative;
  `,
    clusterPillWrapper: css `
    align-items: center;
    min-width: 0;
  `,
    status: css `
    background-color: ${v1.palette.gray1};
    border-radius: 20px;
    color: ${v1.palette.gray85};
    cursor: default;
    font-size: ${typography.size.sm};
    padding: 3px 15px;
    text-transform: uppercase;
  `,
    statusIcon: css `
    color: ${v1.palette.gray1};
    cursor: help;
    margin-left: ${v1.spacing.xs};
    margin-bottom: 0px;
  `,
    statusActive: css `
    background-color: ${colors.primary.main};
    label: active;
  `,
    statusFailed: css `
    background-color: ${v1.palette.brandDanger};
    label: failed;
  `,
    logsWrapper: css `
    bottom: ${v1.spacing.md};
    display: flex;
    position: absolute;
  `,
    logsLabel: css `
    font-size: ${typography.size.sm};
    color: ${v1.colors.linkExternal};
    &:hover {
      color: ${v1.colors.textBlue};
    }
  `,
});
//# sourceMappingURL=DBClusterStatus.styles.js.map