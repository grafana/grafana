import React, { Key, ReactElement, useRef, useState } from 'react';
import { css } from '@emotion/css';
import { useTheme2 } from '@grafana/ui';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { useMenuItem } from '@react-aria/menu';
import { useFocus } from '@react-aria/interactions';
import { TreeState } from '@react-stately/tree';
import { mergeProps } from '@react-aria/utils';
import { Node } from '@react-types/shared';

import { useNavBarItemMenuContext } from './context';

export interface NavBarItemMenuItemProps {
  item: Node<NavModelItem>;
  state: TreeState<NavModelItem>;
  onAction?: (key: Key) => void;
}

export function NavBarItemMenuItem({ item, state, onAction }: NavBarItemMenuItemProps): ReactElement {
  const { onClose } = useNavBarItemMenuContext();
  const { key, rendered } = item;
  const ref = useRef<HTMLLIElement>(null);
  const isDisabled = state.disabledKeys.has(key);

  // style to the focused menu item
  const [isFocused, setFocused] = useState(false);
  const { focusProps } = useFocus({ onFocusChange: setFocused, isDisabled });
  const theme = useTheme2();
  const styles = getStyles(theme, isFocused);

  let { menuItemProps } = useMenuItem(
    {
      isDisabled,
      'aria-label': item['aria-label'],
      key,
      onClose: () => {
        // we want to give react router a chance to handle the click before we call onClose
        setTimeout(() => onClose(), 100);
      },
      closeOnSelect: true,
      onAction,
    },
    state,
    ref
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        // Stop propagation, unless it would already be handled by useKeyboard.
        if (!('continuePropagation' in e)) {
          e.stopPropagation();
        }
        e.preventDefault();
        // Alert: Hacky way to go to link
        // The supported way is to use the `onAction` prop
        // https://github.com/adobe/react-spectrum/issues/1244
        // https://react-spectrum.adobe.com/react-aria/useMenu.html#complex-menu-items
        // NOTE: menu items cannot contain interactive content (e.g. buttons, checkboxes, etc.).
        e.currentTarget?.querySelector('a')?.click();
        e.currentTarget?.querySelector('button')?.click();
        break;
    }
  };

  return (
    <li {...mergeProps(menuItemProps, focusProps)} onKeyDown={onKeyDown} ref={ref} className={styles.menuItem}>
      {rendered}
    </li>
  );
}

function getStyles(theme: GrafanaTheme2, isFocused: boolean) {
  return {
    menuItem: css`
      background-color: ${isFocused ? theme.colors.action.hover : 'transparent'};
      color: ${isFocused ? 'white' : theme.colors.text.primary};

      &:focus-visible {
        background-color: ${theme.colors.action.hover};
        box-shadow: none;
        color: ${theme.colors.text.primary};
        outline: 2px solid ${theme.colors.primary.main};
        // Need to add condition, header is 0, otherwise -2
        outline-offset: -0px;
        transition: none;
      }
    `,
  };
}
