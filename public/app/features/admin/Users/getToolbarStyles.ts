import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

export const getToolbarStyles = (theme: GrafanaTheme2) => ({
  toolbar: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  }),
  // FilterInput's wrapper is width: 100%, which would be its flex-basis and force a wrap.
  search: css({
    flex: `1 1 ${theme.spacing(30)}`,
    minWidth: theme.spacing(20),
  }),
  // RadioButtonGroup sets min-width: 0 and ellipsizes its labels when shrunk.
  filter: css({
    flexShrink: 0,
  }),
  // Extra filters bring their own width; cap it so the search field keeps most of the row.
  extraFilter: css({
    maxWidth: theme.spacing(40),
  }),
});
