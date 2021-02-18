import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ colors, palette, spacing, typography }: GrafanaTheme) => ({
  clusterStatusWrapper: css`
    align-items: center;
    display: flex;
    justify-content: center;
    padding: ${spacing.xs} 0;

    a > span {
      cursor: pointer;
    }
  `,
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
  statusFailed: css`
    background-color: ${palette.brandDanger};
    label: failed;
  `,
  statusUnsupported: css`
    background-color: ${palette.gray1};
  `,
  statusUnavailable: css`
    background-color: ${colors.formSwitchBgActive};
  `,
  InstallLinkIcon: css`
    margin-left: ${spacing.xs};
  `,
});
