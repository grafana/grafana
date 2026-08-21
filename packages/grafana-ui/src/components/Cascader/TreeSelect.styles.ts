import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

export function getTreeSelectStyles(theme: GrafanaTheme2) {
  return {
    menu: css({
      background: theme.components.dropdown.background,
      border: `1px solid ${theme.components.dropdown.borderColor}`,
      borderRadius: theme.shape.radius.lg,
      boxShadow: theme.flags.visualDesignRefresh ? theme.shadows.z2 : theme.shadows.z3,
      maxHeight: 320,
      maxWidth: '50vw',
      overflow: 'auto',
      padding: theme.spacing(0.5),
      position: 'relative',
      width: 'max-content',
      zIndex: theme.zIndex.dropdown,
    }),
    tree: css({
      display: 'flex',
      flexDirection: 'column',
      minWidth: 160,
      outline: 'none',
    }),
    item: css({
      alignItems: 'center',
      background: 'transparent',
      border: 0,
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.primary,
      cursor: 'pointer',
      display: 'flex',
      fontFamily: 'inherit',
      fontSize: theme.typography.body.fontSize,
      gap: theme.spacing(0.5),
      lineHeight: theme.spacing(2.5),
      minHeight: theme.spacing(4),
      paddingBottom: theme.spacing(0.5),
      paddingRight: theme.spacing(1),
      paddingTop: theme.spacing(0.5),
      textAlign: 'left',
      width: '100%',

      '&:hover': {
        background: theme.colors.action.hover,
      },

      '&:focus-visible': {
        background: theme.colors.action.focus,
        outline: `2px solid ${theme.colors.primary.border}`,
        outlineOffset: -2,
      },
    }),
    selected: css({
      background: theme.colors.action.selected,
      color: theme.colors.text.maxContrast,
    }),
    disabled: css({
      color: theme.colors.text.disabled,
      cursor: 'not-allowed',

      '&:hover': {
        background: 'transparent',
      },
    }),
    itemText: css({
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
    }),
    label: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    description: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightRegular,
    }),
    empty: css({
      color: theme.colors.text.secondary,
      padding: theme.spacing(1, 2),
    }),
  };
}
