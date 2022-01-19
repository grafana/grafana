import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ colors, spacing, typography, v1 }: GrafanaTheme2) => ({
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
  statusVersionAvailable: css`
    background-color: ${v1.palette.brandWarning};
    label: versionAvailable;
  `,
  statusFailed: css`
    background-color: ${v1.palette.brandDanger};
    label: failed;
  `,
  statusUnsupported: css`
    background-color: ${v1.palette.gray1};
    label: unsupported;
  `,
  statusUnavailable: css`
    background-color: ${colors.primary.main};
    label: unavailable;
  `,
  installLinkIcon: css`
    margin-left: ${v1.spacing.xs};
  `,
  versionAvailable: css`
    font-size: ${typography.size.sm};
    margin-left: ${v1.spacing.xs};
  `,
});
