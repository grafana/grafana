import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

export function getDraggableListStyles(theme: GrafanaTheme2) {
  return {
    sectionContainer: css({
      '& :has(> ul)': {
        padding: theme.spacing(0, 2, 1, 2),
      },
    }),
    list: css({
      listStyle: 'none',
      margin: 0,
      padding: 0,
      minHeight: theme.spacing(4),
    }),
    listItem: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.25),
    }),
    itemName: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(0.5),
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      cursor: 'pointer',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['color'], {
          duration: theme.transitions.duration.short,
        }),
      },
      button: {
        visibility: 'hidden',
      },
      '&:hover': {
        color: theme.colors.text.link,
        button: {
          visibility: 'visible',
        },
      },
    }),
    dragHandle: css({
      alignSelf: 'stretch',
      cursor: 'grab',
      color: theme.colors.text.secondary,
      '&:hover': {
        color: theme.colors.text.primary,
      },
      '&:active': {
        cursor: 'grabbing',
      },
    }),
  };
}
