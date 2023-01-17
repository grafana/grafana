import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    width: '100%',
    tableLayout: 'fixed',
  }),

  selectedLogGroupsContainer: css({
    marginLeft: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
    display: 'flex',
    flexFlow: 'wrap',
    gap: theme.spacing(1),
    button: {
      margin: 'unset',
    },
  }),

  limitLabel: css({
    color: theme.colors.text.secondary,
    textAlign: 'center',
    maxWidth: 'none',
    svg: {
      marginRight: theme.spacing(0.5),
    },
  }),

  logGroupCountLabel: css({
    color: theme.colors.text.secondary,
    maxWidth: 'none',
  }),

  tableScroller: css({
    maxHeight: '40vh',
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
      width: '80%',
      padding: theme.spacing(1, 1, 1, 2),
    },
  }),

  nestedEntry: css({
    display: 'flex',
    alignItems: 'center',
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

  searchField: css({
    width: '100%',
    marginRight: theme.spacing(1),
  }),

  resultLimit: css({
    margin: '4px 0',
    fontStyle: 'italic',
  }),

  removeButton: css({
    verticalAlign: 'middle',
    marginLeft: theme.spacing(0.5),
  }),

  addBtn: css({
    marginRight: '10px',
  }),
});

export default getStyles;
