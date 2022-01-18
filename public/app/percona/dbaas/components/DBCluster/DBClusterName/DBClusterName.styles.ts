import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  clusterNameWrapper: css`
    display: flex;
  `,
  dashboardIcon: css`
    margin-left: ${spacing.sm};
  `,
});
