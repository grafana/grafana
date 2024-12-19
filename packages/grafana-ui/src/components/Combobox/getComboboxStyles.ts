import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

// We need a px font size to accurately measure the width of items.
// This should be in sync with the body font size in the theme.
export const MENU_ITEM_FONT_SIZE = 14;
export const MENU_ITEM_FONT_WEIGHT = 500;
export const MENU_ITEM_PADDING = 8;
export const MENU_ITEM_LINE_HEIGHT = 1.5;

// Used with Downshift to get the height of each item
export const MENU_OPTION_HEIGHT = MENU_ITEM_PADDING * 2 + MENU_ITEM_FONT_SIZE * MENU_ITEM_LINE_HEIGHT;
export const MENU_OPTION_HEIGHT_DESCRIPTION = MENU_OPTION_HEIGHT + MENU_ITEM_LINE_HEIGHT * MENU_ITEM_FONT_SIZE;
export const POPOVER_MAX_HEIGHT = MENU_OPTION_HEIGHT * 8.5;

export const getComboboxStyles = (theme: GrafanaTheme2) => {
  return {
    menuClosed: css({
      display: 'none',
    }),
    menu: css({
      label: 'combobox-menu',
      background: theme.components.dropdown.background,
      boxShadow: theme.shadows.z3,
      zIndex: theme.zIndex.dropdown,
      position: 'relative',
      borderRadius: theme.shape.radius.default,
    }),
    menuUlContainer: css({
      label: 'combobox-menu-ul-container',
      listStyle: 'none',
    }),
    option: css({
      label: 'combobox-option',
      padding: MENU_ITEM_PADDING,
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
      label: 'combobox-option-body',
      display: 'flex',
      fontWeight: theme.typography.fontWeightMedium,
      flexDirection: 'column',
      flexGrow: 1,
      overflow: 'hidden',
    }),
    optionLabel: css({
      label: 'combobox-option-label',
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      fontSize: MENU_ITEM_FONT_SIZE,
      fontWeight: MENU_ITEM_FONT_WEIGHT,
      letterSpacing: 0, // pr todo: text in grafana has a slightly different letter spacing, which causes measureText() to be ~5% off
    }),
    optionDescription: css({
      label: 'combobox-option-description',
      fontWeight: theme.typography.fontWeightRegular,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      lineHeight: MENU_ITEM_LINE_HEIGHT,
      textOverflow: 'ellipsis',
      overflow: 'hidden',
    }),
    optionFocused: css({
      label: 'combobox-option-focused',
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
      label: 'combobox-clear',
      cursor: 'pointer',
      pointerEvents: 'auto',
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
    warningIcon: css({
      label: 'combobox-warning-icon',
      color: theme.colors.text.secondary,
    }),
    input: css({
      label: 'combobox-input',
      '> div > div:last-child': {
        pointerEvents: 'none',
      },
    }),
    addaptToParent: css({
      label: 'combobox-addapt-to-parent',
      maxWidth: '100%',
      '[class*="input-wrapper-combobox-input"]': {
        maxWidth: '100%',
      },
    }),
  };
};
