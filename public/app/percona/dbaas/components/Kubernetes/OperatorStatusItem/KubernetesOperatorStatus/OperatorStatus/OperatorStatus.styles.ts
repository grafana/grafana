import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ colors, palette, spacing, typography }: GrafanaTheme) => ({
  status: css`
    background-color: ${palette.gray1};
    border-radius: 20px;
    color: ${palette.gray85};
    cursor: default;
    font-size: ${typography.size.sm};
    padding: 3px 15px;
    display: flex;
  `,
  statusActive: css`
    background-color: ${palette.brandSuccess};
    label: active;
  `,
  statusVersionAvailable: css`
    background-color: ${palette.brandWarning};
    label: versionAvailable;
  `,
  statusFailed: css`
    background-color: ${palette.brandDanger};
    label: failed;
  `,
  statusUnsupported: css`
    background-color: ${palette.gray1};
    label: unsupported;
  `,
  statusUnavailable: css`
    background-color: ${colors.formSwitchBgActive};
    label: unavailable;
  `,
  installLinkIcon: css`
    margin-left: ${spacing.xs};
  `,
  versionAvailable: css`
    font-size: ${typography.size.sm};
    margin-left: ${spacing.xs};
  `,
});
