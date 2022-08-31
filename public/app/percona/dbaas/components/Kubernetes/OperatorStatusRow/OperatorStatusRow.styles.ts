import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  operatorRowWrapper: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,
});
