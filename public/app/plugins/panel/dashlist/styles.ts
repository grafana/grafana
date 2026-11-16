import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    dashlistCardContainer: css({
      display: 'block',
      height: '100%',
      paddingLeft: theme.spacing(2),

      '&:has(a:hover)': {
        background: theme.colors.emphasize(theme.components.card.background, 0.03),
        cursor: 'pointer',
        color: theme.colors.text.primary,
      },
    }),
    dashlistCard: css({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: theme.spacing(0.75),
      height: '100%',
      width: '100%',

      '&:hover': {
        '> div': {
          '&:first-child': {
            color: theme.colors.text.link,
            textDecoration: 'underline',
          },
        },
      },
    }),
    dashlistCardIcon: css({
      marginRight: theme.spacing(0.25),
      marginTop: theme.spacing(0.25),
    }),
    dashlistCardLink: css({
      whiteSpace: 'normal',
      overflowWrap: 'break-word',
      wordBreak: 'break-word',
      display: '-webkit-box',
      WebkitBoxOrient: 'vertical',
      WebkitLineClamp: 2,
      overflow: 'hidden',
      [theme.breakpoints.down('lg')]: {
        WebkitLineClamp: 1,
      },
    }),
    dashlistCardFolder: css({
      display: '-webkit-box',
      WebkitBoxOrient: 'vertical',
      WebkitLineClamp: 1,
      overflow: 'hidden',
      whiteSpace: 'normal',
    }),
  };
};
