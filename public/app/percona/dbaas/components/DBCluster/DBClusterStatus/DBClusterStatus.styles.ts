import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ colors, palette, spacing, typography }: GrafanaTheme) => ({
  clusterStatusWrapper: css`
    align-items: flex-end;
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin: ${spacing.sm};
    min-width: 125px;
    padding: ${spacing.xs} 0;
    position: relative;
  `,
  clusterPillWrapper: css`
    align-items: center;
    min-width: 0;
  `,
  status: css`
    background-color: ${palette.gray1};
    border-radius: 20px;
    color: ${palette.gray85};
    cursor: default;
    font-size: ${typography.size.sm};
    padding: 3px 15px;
    text-transform: uppercase;
  `,
  statusIcon: css`
    color: ${palette.gray1};
    cursor: help;
    margin-left: ${spacing.xs};
    margin-bottom: 0px;
  `,
  statusActive: css`
    background-color: ${colors.formSwitchBgActive};
    label: active;
  `,
  statusFailed: css`
    background-color: ${palette.brandDanger};
    label: failed;
  `,
  logsWrapper: css`
    bottom: ${spacing.md};
    display: flex;
    position: absolute;
  `,
  logsLabel: css`
    font-size: ${typography.size.sm};
    color: ${colors.linkExternal};
    &:hover {
      color: ${colors.textBlue};
    }
  `,
});
