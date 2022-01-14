import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  connectionWrapper: css`
    display: flex;
    flex-direction: column;
    margin: ${spacing.xs} ${spacing.sm};
  `,
});
