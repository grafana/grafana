import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    width: '100%',
    tableLayout: 'fixed',
  }),

  tableScroller: css({
    maxHeight: '50vh',
    overflow: 'auto',
  }),

  row: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,

    '&:last-of-type': {
      borderBottomColor: theme.colors.border.medium,
    },
  }),

  cell: css({
    padding: theme.spacing(1, 1, 1, 0),
    width: '25%',
    '&:first-of-type': {
      width: '50%',
      padding: theme.spacing(1, 1, 1, 2),
    },
  }),

  logGroupSearchResults: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    width: '90%',
    verticalAlign: 'middle',
  }),

  modal: css({
    width: theme.breakpoints.values.lg,
  }),

  selectAccountId: css({
    maxWidth: '100px',
  }),

  logGroupSelectionArea: css({
    display: 'flex',
  }),

  resultLimit: css({
    margin: '4px 0',
    fontStyle: 'italic',
  }),

  selectedLogGroup: css({
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.borderRadius(),
    margin: theme.spacing(0.25, 1, 0.25, 0),
    padding: theme.spacing(0.25, 0, 0.25, 1),
    color: theme.colors.text.primary,
    fontSize: theme.typography.size.sm,
  }),

  search: css({
    marginRight: '10px',
  }),

  removeButton: css({
    verticalAlign: 'middle',
  }),

  addBtn: css({
    marginRight: '10px',
  }),
});

export default getStyles;
