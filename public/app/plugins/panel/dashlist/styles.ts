import { css } from '@emotion/css';

import { GrafanaTheme2, colorManipulator } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => {
  const gradient = `linear-gradient(
    90deg,
    ${colorManipulator.alpha(theme.colors.primary.text, 0.1)} 0%,
    ${colorManipulator.alpha(theme.colors.secondary.main, 0.1)} 100%
  )`;
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
    dashlistCard: css({
      display: 'flex',
      flexDirection: 'column',
      '&:hover a': {
        color: theme.colors.text.link,
        textDecoration: 'underline',
      },
      height: '100%',

      '&:hover': {
        backgroundImage: gradient,
        color: theme.colors.text.primary,
      },
    }),
    dashlistCardIcon: css({
      marginRight: theme.spacing(0.5),
    }),
  };
};
