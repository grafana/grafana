import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme2) => ({
  rowContentWrapper: css`
    display: flex;
    flex-direction: column;
  `,
  fullRowContent: css`
    flex-basis: 100%;
    max-width: 100%;
  `,
  row: css`
    display: flex;
    flex-wrap: wrap;
    gap: ${spacing(4)};
  `,
});
