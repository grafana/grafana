import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getAlertTableStyles = (theme: GrafanaTheme2) => ({
  table: css({
    width: '100%',
    borderRadius: theme.shape.radius.default,
    border: `solid 1px ${theme.colors.border.weak}`,
    backgroundColor: theme.colors.background.secondary,
    overflow: 'hidden',

    th: {
      padding: theme.spacing(1),
    },

    td: {
      padding: `0 ${theme.spacing(1)}`,
    },

    tr: {
      height: '38px',
    },
  }),
  evenRow: css({
    backgroundColor: theme.colors.background.primary,
  }),
  colExpand: css({
    width: '36px',
  }),
  nameCell: css({
    gap: theme.spacing(1),
  }),
  actionsCell: css({
    textAlign: 'right',
    width: '1%',
    whiteSpace: 'nowrap',

    '& > * + *': {
      marginLeft: theme.spacing(0.5),
    },
  }),
});
