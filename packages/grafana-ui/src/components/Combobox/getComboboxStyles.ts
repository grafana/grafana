import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getComboboxStyles = (theme: GrafanaTheme2) => {
  return {
    menuClosed: css({
      display: 'none',
    }),
    menu: css({
      label: 'grafana-select-menu',
      background: theme.components.dropdown.background,
      boxShadow: theme.shadows.z3,
      zIndex: theme.zIndex.dropdown,
    }),
    menuHeight: css({
      height: 400,
      overflowY: 'scroll',
      position: 'relative',
    }),
    menuUlContainer: css({
      label: 'grafana-select-menu-ul-container',
      listStyle: 'none',
    }),
    option: css({
      label: 'grafana-select-option',
      padding: '8px',
      position: 'absolute',
      display: 'flex',
      alignItems: 'center',
      flexDirection: 'row',
      flexShrink: 0,
      whiteSpace: 'nowrap',
      width: '100%',
      overflow: 'hidden',
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
      overflow: 'hidden',
    }),
    optionLabel: css({
      label: 'grafana-select-option-label',
      textOverflow: 'ellipsis',
      overflow: 'hidden',
    }),
    optionDescription: css({
      label: 'grafana-select-option-description',
      fontWeight: 'normal',
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      lineHeight: theme.typography.body.lineHeight,
      textOverflow: 'ellipsis',
      overflow: 'hidden',
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
