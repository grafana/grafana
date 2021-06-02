import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  paramWrapper: css`
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
  `,
  paramLabel: css`
    margin-right: ${spacing.sm};
    text-transform: capitalize;
  `,
});
