import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    width: '100%',
  }),

  header: css({
    background: theme.colors.background.secondary,
  }),

  cell: css({
    padding: theme.spacing(1, 0),

    'tr &:first-of-type': {
      padding: theme.spacing(1, 0, 1, 2),
    },
  }),
});

export default getStyles;
