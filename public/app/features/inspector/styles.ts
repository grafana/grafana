import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';

/** @deprecated */
export const getPanelInspectorStyles = stylesFactory(() => {
  return getPanelInspectorStyles2(config.theme2);
});

export const getPanelInspectorStyles2 = (theme: GrafanaTheme2) => {
  return {
    heading: css({
      fontSize: theme.typography.body.fontSize,
      marginBottom: theme.spacing(1),
    }),
    wrap: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      flex: '1 1 0',
      minHeight: 0,
    }),
    toolbar: css({
      display: 'flex',
      width: '100%',
      flexGrow: 0,
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginBottom: theme.v1.spacing.sm,
    }),
    toolbarItem: css({
      marginLeft: theme.v1.spacing.md,
    }),
    content: css({
      flexGrow: 1,
      height: '100%',
    }),
    editor: css({
      fontFamily: 'monospace',
      height: '100%',
      flexGrow: 1,
    }),
    viewer: css({
      overflow: 'scroll',
    }),
    dataFrameSelect: css({
      flexGrow: 2,
    }),
    leftActions: css({
      display: 'flex',
      flexGrow: 1,

      maxWidth: '85%',
      '@media (max-width: 1345px)': {
        maxWidth: '75%',
      },
    }),
    options: css({
      paddingTop: theme.v1.spacing.sm,
    }),
    dataDisplayOptions: css({
      flexGrow: 1,
      minWidth: '300px',
      marginRight: theme.v1.spacing.sm,
    }),
    selects: css({
      display: 'flex',
      '> *': {
        marginRight: theme.v1.spacing.sm,
      },
    }),
  };
};
