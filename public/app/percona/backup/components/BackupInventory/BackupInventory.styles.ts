import { css } from 'emotion';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  addWrapper: css`
    display: flex;
    justify-content: flex-end;
    margin-bottom: ${spacing.sm};
  `,
});
