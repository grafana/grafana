import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { alpha } from '../../../../../packages/grafana-data/src/themes/colorManipulator';

export const getStyles = (theme: GrafanaTheme2) => {
  const accent = theme.visualization.getColorByName('purple');
  const gradient = `linear-gradient(
    90deg,
    ${alpha(accent, 0.28)} 0%,
    ${alpha('#9578eaff', 0.28)} 100%
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
