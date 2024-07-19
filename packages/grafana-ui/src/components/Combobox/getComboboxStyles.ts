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
    }),
    option: css({
      label: 'grafana-select-option',
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      borderLeft: '2px solid transparent',
      padding: theme.spacing.x1,
      boxSizing: 'border-box',
      height: 'auto',
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
      fontSize: theme.typography.size.sm,
      color: theme.colors.text.secondary,
      whiteSpace: 'normal',
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
        transform: 'translateX(-50%)',
        width: theme.spacing(0.5),
        left: 0,
        top: 0,
      },
    }),
  };
};
