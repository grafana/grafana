import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

import { getFocusStyles } from '../../themes/mixins';
import { getComboboxStyles, MENU_PADDING, POPOVER_MAX_HEIGHT } from '../Combobox/getComboboxStyles';

export function getTreeSelectStyles(theme: GrafanaTheme2) {
  const combobox = getComboboxStyles(theme);

  return {
    menu: cx(
      combobox.menu,
      css({
        maxHeight: POPOVER_MAX_HEIGHT,
        maxWidth: '50vw',
        overflow: 'auto',
        padding: MENU_PADDING,
        width: 'max-content',
      })
    ),
    tree: css({
      display: 'flex',
      flexDirection: 'column',
      minWidth: 160,
      outline: 'none',
    }),
    // Resets button element styling on top of the combobox option look.
    item: cx(
      combobox.option,
      css({
        background: 'transparent',
        border: 0,
        color: theme.colors.text.primary,
        font: 'inherit',
        textAlign: 'left',

        '&:focus-visible': {
          background: theme.colors.action.focus,
          ...getFocusStyles(theme),
        },
      })
    ),
    selected: combobox.optionSelected,
    disabled: combobox.optionInfo,
    itemText: combobox.optionBody,
    label: combobox.optionLabel,
    description: combobox.optionDescription,
  };
}
