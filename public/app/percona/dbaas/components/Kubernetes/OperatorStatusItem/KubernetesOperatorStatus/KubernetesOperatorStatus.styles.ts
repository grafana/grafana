import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  clusterStatusWrapper: css`
    align-items: center;
    display: flex;
    justify-content: center;
    padding: ${spacing.xs} 0;

    a > span {
      cursor: pointer;
    }
  `,
});
