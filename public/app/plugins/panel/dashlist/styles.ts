import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    dashlistLink: css({
      display: 'flex',
      cursor: 'pointer',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      margin: theme.spacing(1),
      padding: theme.spacing(1),
      alignItems: 'center',

      '&:hover': {
        a: {
          color: theme.colors.text.link,
          textDecoration: 'underline',
        },
      },
    }),
  };
};
