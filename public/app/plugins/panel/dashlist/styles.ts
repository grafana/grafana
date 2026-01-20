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
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      margin: theme.spacing(1),
      padding: theme.spacing(1),
      alignItems: 'center',

      a: {
        flex: 1,

        '&:hover': {
          '> p': {
            '&:first-child': {
              color: theme.colors.text.link,
              textDecoration: 'underline',
            },
          },
        },
      },
    }),
    dashlistCardContainer: css({
      display: 'block',
      height: '100%',
      paddingBottom: theme.spacing(0.5),
      '&:hover': {
        backgroundImage: gradient,
        color: theme.colors.text.primary,
      },
    }),
    dashlistCard: css({
      display: 'grid',
      gridTemplateRows: '1fr 1fr',
      gap: theme.spacing(2),
      flexDirection: 'column',
      '&:hover a': {
        color: theme.colors.text.link,
        textDecoration: 'underline',
      },
      height: '100%',
      width: '100%',
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
    }),
    dashlistCardFolder: css({
      display: '-webkit-box',
      WebkitBoxOrient: 'vertical',
      WebkitLineClamp: 2,
      overflow: 'hidden',
      whiteSpace: 'normal',
    }),
  };
};
