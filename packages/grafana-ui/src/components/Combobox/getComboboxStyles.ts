import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

// We need a px font size to accurately measure the width of items.
// This should be in sync with the body font size in the theme.
export const MENU_ITEM_FONT_SIZE = 14;
export const MENU_ITEM_DESCRIPTION_FONT_SIZE = 12;
export const MENU_ITEM_FONT_WEIGHT = 500;
export const MENU_ITEM_PADDING = 8;
export const MENU_ITEM_GAP = 2;
export const MENU_ITEM_LINE_HEIGHT = 1.5;

// Used with Downshift to get the height of each item
export const MENU_OPTION_HEIGHT = MENU_ITEM_GAP + MENU_ITEM_PADDING * 2 + MENU_ITEM_FONT_SIZE * MENU_ITEM_LINE_HEIGHT;
export const MENU_OPTION_HEIGHT_DESCRIPTION =
  MENU_OPTION_HEIGHT + MENU_ITEM_DESCRIPTION_FONT_SIZE * MENU_ITEM_LINE_HEIGHT;
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
      overflow: 'hidden',
    }),
    menuUlContainer: css({
      label: 'combobox-menu-ul-container',
      listStyle: 'none',
    }),

    // The wrapper around the group header and option, not the option itself.
    // Should not contain visual styling itself.
    listItem: css({
      label: 'list-item',
      position: 'absolute',
      width: '100%',
    }),

    optionGroupHeader: css({
      label: 'combobox-new-option-group',
      borderTop: `1px solid ${theme.colors.border.weak}`,
    }),

    optionFirstGroupHeader: css({
      borderTop: 'none',
    }),

    optionGroupLabel: css({
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      letterSpacing: 0,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightLight,
      padding: MENU_ITEM_PADDING,
    }),

    option: css({
      label: 'combobox-option',
      position: 'relative', // for the selection gradient to grab to
      display: 'flex',
      width: '100%',
      gap: theme.spacing(1),
      alignItems: 'center',
      padding: MENU_ITEM_PADDING,
      marginBottom: MENU_ITEM_GAP,
      borderRadius: theme.shape.radius.default,
      fontWeight: theme.typography.fontWeightMedium,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      cursor: 'pointer',
      '&:hover': {
        background: theme.colors.action.hover,
        '@media (forced-colors: active), (prefers-contrast: more)': {
          border: `1px solid ${theme.colors.primary.border}`,
        },
      },
    }),

    optionAccessory: css({
      label: 'combobox-option-accessory',
      height: MENU_ITEM_FONT_SIZE * MENU_ITEM_LINE_HEIGHT, // Ensure the accessory doesn't make the option too tall
    }),

    optionBody: css({
      label: 'combobox-option-body',
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      overflow: 'hidden',
    }),

    optionLabel: css({
      label: 'combobox-option-label',
      fontSize: MENU_ITEM_FONT_SIZE,
      fontWeight: MENU_ITEM_FONT_WEIGHT,
      lineHeight: MENU_ITEM_LINE_HEIGHT,
      letterSpacing: 0,
      textOverflow: 'ellipsis',
      overflow: 'hidden',
    }),

    optionDescription: css({
      label: 'combobox-option-description',
      color: theme.colors.text.secondary,
      fontSize: MENU_ITEM_DESCRIPTION_FONT_SIZE,
      fontWeight: theme.typography.fontWeightRegular,
      lineHeight: MENU_ITEM_LINE_HEIGHT,
      letterSpacing: 0,
      textOverflow: 'ellipsis',
      overflow: 'hidden',
    }),

    optionFocused: css({
      label: 'combobox-option-focused',
      // top: 0,
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
    input: css({
      label: 'combobox-input',
      '> div > div:last-child': {
        pointerEvents: 'none',
      },
      '& input': {
        cursor: 'pointer',
      },
      '& input:focus': {
        cursor: 'text',
      },
    }),
    adaptToParent: css({
      label: 'combobox-adapt-to-parent',
      maxWidth: '100%',
      '[class*="input-wrapper-combobox-input"]': {
        maxWidth: '100%',
      },
    }),
  };
};
