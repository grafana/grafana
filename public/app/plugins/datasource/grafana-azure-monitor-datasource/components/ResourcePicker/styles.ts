import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    width: '100%',
  }),

  tableScroller: css({
    maxHeight: '50vh',
    overflow: 'auto',
  }),

  header: css({
    background: theme.colors.background.secondary,
  }),

  row: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,

    '&:last-of-type': {
      borderBottomColor: theme.colors.border.medium,
    },
  }),

  disabledRow: css({
    opacity: 0.5,
  }),

  cell: css({
    padding: theme.spacing(1, 0),
    width: '25%',

    '&:first-of-type': {
      width: '50%',
      padding: theme.spacing(1, 0, 1, 2),
    },
  }),

  collapseButton: css({ margin: 0 }),

  loadingCell: css({
    textAlign: 'center',
  }),
});

export default getStyles;
