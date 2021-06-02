import { css } from 'emotion';

import { GrafanaTheme } from '@grafana/data';

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
