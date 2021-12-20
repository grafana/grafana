import React, { ReactElement, useRef, useState } from 'react';
import { css } from '@emotion/css';
import { useTheme2 } from '@grafana/ui';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { useMenuItem } from '@react-aria/menu';
import { useFocus } from '@react-aria/interactions';
import { TreeState } from '@react-stately/tree';
import { mergeProps } from '@react-aria/utils';
import { Node } from '@react-types/shared';
import classNames from 'classnames';

import { useNavBarItemMenuContext } from './context';

export interface NavBarItemMenuItemProps {
  className?: string;
  item: Node<NavModelItem>;
  state: TreeState<NavModelItem>;
  onNavigate: (item: NavModelItem) => void;
}

export function NavBarItemMenuItem({ className, item, state, onNavigate }: NavBarItemMenuItemProps): ReactElement {
  const { onClose } = useNavBarItemMenuContext();
  const { key, rendered } = item;
  const ref = useRef<HTMLLIElement>(null);
  const isDisabled = state.disabledKeys.has(key);

  // style to the focused menu item
  const [isFocused, setFocused] = useState(false);
  const { focusProps } = useFocus({ onFocusChange: setFocused, isDisabled });
  const theme = useTheme2();
  const styles = getStyles(theme, isFocused);
  const onAction = () => {
    onNavigate(item.value);
    onClose();
  };

  let { menuItemProps } = useMenuItem(
    {
      isDisabled,
      'aria-label': item['aria-label'],
      key,
      closeOnSelect: true,
      onClose,
      onAction,
    },
    state,
    ref
  );

  return (
    <li {...mergeProps(menuItemProps, focusProps)} ref={ref} className={classNames(styles.menuItem, className)}>
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
