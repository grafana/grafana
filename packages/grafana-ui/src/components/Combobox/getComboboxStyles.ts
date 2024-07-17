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
    }),
    option: css({
      label: 'grafana-select-option',
      padding: '8px',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      flexDirection: 'row',
      flexShrink: 0,
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      borderLeft: '2px solid transparent',

      '&:hover': {
        background: theme.colors.action.hover,
        '@media (forced-colors: active), (prefers-contrast: more)': {
          border: `1px solid ${theme.colors.primary.border}`,
        },
      },
    }),
    optionDescription: css({
      label: 'grafana-select-option-description',
      fontWeight: 'normal',
      fontSize: theme.typography.size.sm,
      color: theme.colors.text.secondary,
      whiteSpace: 'normal',
      lineHeight: theme.typography.body.lineHeight,
    }),
    optionBody: css({
      label: 'grafana-select-option-body',
      display: 'flex',
      fontWeight: theme.typography.fontWeightMedium,
      flexDirection: 'column',
      flexGrow: 1,
    }),
    optionFocused: css({
      label: 'grafana-select-option-focused',
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
      },
    }),
    optionDisabled: css({
      label: 'grafana-select-option-disabled',
      backgroundColor: theme.colors.action.disabledBackground,
      color: theme.colors.action.disabledText,
      cursor: 'not-allowed',
    }),
    valueContainer: css({
      label: 'grafana-select-value-container',
      alignItems: 'center',
      display: 'grid',
      position: 'relative',
      boxSizing: 'border-box',
      flex: '1 1 0%',
      outline: 'none',
      overflow: 'hidden',
    }),
  };
};
