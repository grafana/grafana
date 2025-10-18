import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { ResourcePickerQueryType } from '../../resourcePicker/resourcePickerData';

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    width: '100%',
    tableLayout: 'fixed',
    overflow: 'scroll',
  }),

  scrollableTable: css({
    overflow: 'auto',
  }),

  tableScroller: css({
    maxHeight: '35vh',
  }),

  selectedTableScroller: css({
    maxHeight: '35vh',
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
    padding: theme.spacing(1, 1, 1, 0),
    width: '25%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    '&:first-of-type': {
      width: '50%',
      padding: theme.spacing(1, 1, 1, 2),
    },
  }),

  collapseButton: css({ margin: 0 }),

  loadingCell: css({
    textAlign: 'center',
  }),

  spinner: css({
    marginBottom: 0,
  }),

  nestedEntry: css({
    display: 'flex',
    alignItems: 'center',
  }),

  entryContentItem: css({
    margin: theme.spacing(0, 1, 0, 0),
  }),

  truncated: css({
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),

  resourceField: css({
    maxWidth: theme.spacing(36),
    overflow: 'hidden',
  }),

  resourceFieldButton: css({
    padding: '7px',
    textAlign: 'left',
  }),

  nestedRowCheckbox: css({
    zIndex: 0,
  }),

  selectionFooter: css({
    background: theme.colors.background.primary,
    paddingTop: theme.spacing(2),
  }),

  loadingWrapper: css({
    textAlign: 'center',
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
    color: theme.colors.text.secondary,
  }),

  resultLimit: css({
    margin: '4px 0',
    fontStyle: 'italic',
  }),

  modal: css({
    width: theme.breakpoints.values.lg,
    maxHeight: '80vh',
  }),

  filterInput: (queryType: ResourcePickerQueryType) =>
    css({
      width: queryType === 'metrics' ? '30%' : '50%',
      marginTop: '10px',
    }),
});

export default getStyles;
