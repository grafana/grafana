import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => ({
  createContainer: css`
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    padding: ${theme.spacing(1)} 0;
  `,
  description: css`
    max-width: 720px;
  `,
  link: css`
    color: ${theme.colors.text.link};
  `,
});
