import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ colors, typography, v1 }: GrafanaTheme2) => ({
  clusterStatusWrapper: css`
    align-items: center;
    display: flex;
    justify-content: center;
    padding: ${v1.spacing.xs} 0;

    a > span {
      cursor: pointer;
    }
  `,
  status: css`
    background-color: ${v1.palette.gray1};
    border-radius: 20px;
    color: ${v1.palette.gray85};
    cursor: default;
    font-size: ${typography.size.sm};
    padding: 3px 15px;
    display: flex;
  `,
  statusActive: css`
    background-color: ${v1.palette.brandSuccess};
    label: active;
  `,
  statusFailed: css`
    background-color: ${v1.palette.brandDanger};
    label: failed;
  `,
  statusUnsupported: css`
    background-color: ${v1.palette.gray1};
  `,
  statusUnavailable: css`
    background-color: ${colors.primary.main};
  `,
  installLinkIcon: css`
    margin-left: ${v1.spacing.xs};
  `,
});
