import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getComboboxStyles = (theme: GrafanaTheme2) => {
  return {
    menu: css({
      label: 'grafana-select-menu',
      background: theme.components.dropdown.background,
      boxShadow: theme.shadows.z3,
      position: 'relative',
      zIndex: 1,
    }),
    menuHeight: css({
      height: 400,
      overflowY: 'scroll',
      position: 'relative',
    }),
    menuUlContainer: css({
      label: 'grafana-select-menu-ul-container',
      listStyle: 'none',
      // Place all children in a single cell, give them position relative and then do a transform
      // This produces the same effect as position: absolute, but the container will fit the width of the longest child
      // This might only work if all items are the same height
      display: 'grid',
      gridTemplateColumns: '1fr',
      gridTemplateRows: '1fr',
    }),
    option: css({
      label: 'grafana-select-option',
      padding: '8px',
      position: 'relative',
      gridRow: 1,
      gridColumn: 1,
      display: 'flex',
      alignItems: 'center',
      flexDirection: 'row',
      flexShrink: 0,
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      '&:hover': {
        background: theme.colors.action.hover,
        '@media (forced-colors: active), (prefers-contrast: more)': {
          border: `1px solid ${theme.colors.primary.border}`,
        },
      },
    }),
    optionBody: css({
      label: 'grafana-select-option-body',
      display: 'flex',
      fontWeight: theme.typography.fontWeightMedium,
      flexDirection: 'column',
      flexGrow: 1,
    }),
    optionDescription: css({
      label: 'grafana-select-option-description',
      fontWeight: 'normal',
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      lineHeight: theme.typography.body.lineHeight,
    }),
    optionFocused: css({
      label: 'grafana-select-option-focused',
      top: 0,
      background: theme.colors.action.focus,
      '@media (forced-colors: active), (prefers-contrast: more)': {
        border: `1px solid ${theme.colors.primary.border}`,
      },
    }),
    optionSelected: css({
      background: theme.colors.action.selected,
      '&::before': {
        backgroundImage: theme.colors.gradients.brandVertical,
        borderRadius: theme.shape.radius.default,
        content: '" "',
        display: 'block',
        height: '100%',
        position: 'absolute',
        //transform: 'translateX(-50%)',
        width: theme.spacing(0.5),
        left: 0,
        top: 0,
      },
    }),
    clear: css({
      label: 'grafana-select-clear',
      cursor: 'pointer',
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
  };
};
