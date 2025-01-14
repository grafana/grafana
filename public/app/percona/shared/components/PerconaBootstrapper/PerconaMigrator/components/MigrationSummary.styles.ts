import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => ({
  modal: css`
    width: auto;
    min-width: 750px;
    max-width: 75vw;
  `,
  migrationSummary: css`
    padding: ${theme.spacing(2)};
    padding-top: 0;
  `,
  list: css`
    margin-top: ${theme.spacing(0.5)};
    margin-bottom: ${theme.spacing(2)};

    ol,
    ul {
      margin-left: ${theme.spacing(2)};

      li > * {
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  `,
});
