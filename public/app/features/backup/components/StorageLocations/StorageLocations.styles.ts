import { css } from 'emotion';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  nameWrapper: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
  `,
  addWrapper: css`
    display: flex;
    justify-content: flex-end;
    margin-bottom: ${spacing.sm};
  `,
});
