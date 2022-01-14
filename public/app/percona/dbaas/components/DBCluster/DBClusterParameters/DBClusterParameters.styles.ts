import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  wrapper: css`
    display: flex;
    flex-direction: column;
    margin: ${spacing.xs} ${spacing.sm};
  `,
  parametersFailed: css`
    display: flex;
    justify-content: center;
  `,
});
