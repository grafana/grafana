import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    dashlistSectionHeader: css({
      padding: theme.spacing(0.25, 1),
      marginRight: theme.spacing(1),
    }),
    dashlistSection: css({
      marginBottom: theme.spacing(2),
      paddingTop: theme.spacing(0.5),
    }),
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
    dashlistFolder: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: theme.typography.body.lineHeight,
    }),
    dashlistTitle: css({
      '&::after': {
        position: 'absolute',
        content: '""',
        left: 0,
        top: 0,
        bottom: 0,
        right: 0,
      },
    }),
    dashlistLinkBody: css({
      flexGrow: 1,
    }),
    dashlistItem: css({
      position: 'relative',
      listStyle: 'none',
    }),
  };
};
