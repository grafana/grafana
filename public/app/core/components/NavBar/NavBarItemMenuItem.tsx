import { css } from '@emotion/css';
import { useFocus, useKeyboard } from '@react-aria/interactions';
import { useMenuItem } from '@react-aria/menu';
import { mergeProps } from '@react-aria/utils';
import { TreeState } from '@react-stately/tree';
import { Node } from '@react-types/shared';
import React, { ReactElement, useRef, useState } from 'react';

import { GrafanaTheme2, NavMenuItemType, NavModelItem } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { NestedSubMenu } from './NestedSubMenu';
import { useNavBarItemMenuContext, useNavBarContext } from './context';

export interface NavBarItemMenuItemProps {
  item: Node<NavModelItem>;
  state: TreeState<NavModelItem>;
  onNavigate: (item: NavModelItem) => void;
}

export function NavBarItemMenuItem({ item, state, onNavigate }: NavBarItemMenuItemProps): ReactElement {
  const { onClose, onLeft } = useNavBarItemMenuContext();
  const { setMenuIdOpen } = useNavBarContext();
  const { key, rendered } = item;
  const ref = useRef<HTMLLIElement>(null);
  const isDisabled = state.disabledKeys.has(key);

  // style to the focused menu item
  const [isFocused, setFocused] = useState(false);
  const { focusProps } = useFocus({ onFocusChange: setFocused, isDisabled });
  const theme = useTheme2();
  const isSection = item.value.menuItemType === 'section';
  const styles = getStyles(theme, isFocused, isSection);
  const onAction = () => {
    if (isNested(item.value) && !item.value.url) {
      return;
    }

    setMenuIdOpen(undefined);
    onNavigate(item.value);
    onClose();
  };

  let { menuItemProps } = useMenuItem(
    {
      isDisabled,
      'aria-label': item['aria-label'],
      key,
      closeOnSelect: !isNested(item.value) || !!item.value.url,
      onClose,
      onAction,
    },
    state,
    ref
  );

  const { keyboardProps } = useKeyboard({
    onKeyDown: (e) => {
      if (e.key === 'ArrowLeft') {
        onLeft();
      }
      e.continuePropagation();
    },
  });

  return (
    <>
      <li
        {...mergeProps(menuItemProps, focusProps, keyboardProps)}
        role={isNested(item.value) && !item.value.url ? 'menu' : 'menuitem'}
        ref={ref}
        className={styles.menuItem}
      >
        {rendered}
        {/* @Percona */}
        {isNested(item.value) && <NestedSubMenu items={item.value.children} />}
      </li>
    </>
  );
}

function isNested(item: NavModelItem) {
  return !!item.children?.length && item.menuItemType === NavMenuItemType.Item;
}

function getStyles(theme: GrafanaTheme2, isFocused: boolean, isSection: boolean) {
  let backgroundColor = 'transparent';
  if (isFocused) {
    backgroundColor = theme.colors.action.hover;
  }
  return {
    menuItem: css`
      background-color: ${backgroundColor};
      color: ${theme.colors.text.primary};
      position: relative;

      &:focus-visible {
        background-color: ${theme.colors.action.hover};
        box-shadow: none;
        color: ${theme.colors.text.primary};
        outline: 2px solid ${theme.colors.primary.main};
        outline-offset: -2px;
        transition: none;
      }

      /*
        @Percona 
        show nested menu on hover
      */
      &:hover {
        & > ul {
          opacity: 1;
          visibility: visible;
        }
      }
    `,
    menuArrow: css`
      position: absolute;
      right: 5px;
      top: 0;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    `,
  };
}
