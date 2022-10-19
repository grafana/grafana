import { css } from '@emotion/css';
import { useMenu } from '@react-aria/menu';
import { mergeProps } from '@react-aria/utils';
import { useTreeState } from '@react-stately/tree';
import { SpectrumMenuProps } from '@react-types/menu';
import React, { ReactElement, useEffect, useRef } from 'react';

import { GrafanaTheme2, NavMenuItemType, NavModelItem } from '@grafana/data';
import { CustomScrollbar, useTheme2 } from '@grafana/ui';

import { NavBarItemMenuItem } from './NavBarItemMenuItem';
import { useNavBarItemMenuContext } from './context';
import { getNavTitle } from './navBarItem-translations';
import { getNavModelItemKey } from './utils';

export interface NavBarItemMenuProps extends SpectrumMenuProps<NavModelItem> {
  onNavigate: (item: NavModelItem) => void;
  adjustHeightForBorder: boolean;
  reverseMenuDirection?: boolean;
}

export function NavBarItemMenu(props: NavBarItemMenuProps): ReactElement | null {
  const { reverseMenuDirection, adjustHeightForBorder, disabledKeys, onNavigate, ...rest } = props;
  const contextProps = useNavBarItemMenuContext();
  const completeProps = {
    ...mergeProps(contextProps, rest),
  };
  const { menuHasFocus, menuProps: contextMenuProps = {} } = contextProps;
  const theme = useTheme2();
  const styles = getStyles(theme, reverseMenuDirection);
  const state = useTreeState<NavModelItem>({ ...rest, disabledKeys });
  const ref = useRef(null);
  const { menuProps } = useMenu(completeProps, { ...state }, ref);
  const allItems = [...state.collection];
  const items = allItems.filter((item) => item.value.menuItemType === NavMenuItemType.Item);
  const section = allItems.find((item) => item.value.menuItemType === NavMenuItemType.Section);

  useEffect(() => {
    if (menuHasFocus && !state.selectionManager.isFocused) {
      state.selectionManager.setFocusedKey(section?.key ?? '');
      state.selectionManager.setFocused(true);
    } else if (!menuHasFocus) {
      state.selectionManager.setFocused(false);
      state.selectionManager.setFocusedKey('');
      state.selectionManager.clearSelection();
    }
  }, [menuHasFocus, state.selectionManager, reverseMenuDirection, section?.key]);

  if (!section) {
    return null;
  }

  const menuSubTitle = section.value.subTitle;

  const headerComponent = <NavBarItemMenuItem key={section.key} item={section} state={state} onNavigate={onNavigate} />;

  const itemComponents = items.map((item) => (
    <NavBarItemMenuItem key={getNavModelItemKey(item.value)} item={item} state={state} onNavigate={onNavigate} />
  ));

  if (itemComponents.length === 0 && section.value.emptyMessageId) {
    const emptyMessageTranslated = getNavTitle(section.value.emptyMessageId);
    itemComponents.push(
      <div key="empty-message" className={styles.emptyMessage}>
        {emptyMessageTranslated}
      </div>
    );
  }

  const subTitleComponent = menuSubTitle && (
    <li key={menuSubTitle} className={styles.subtitle}>
      {menuSubTitle}
    </li>
  );

  const contents = [itemComponents, subTitleComponent];
  const contentComponent = (
    <CustomScrollbar hideHorizontalTrack hideVerticalTrack showScrollIndicators key="scrollContainer">
      {reverseMenuDirection ? contents.reverse() : contents}
    </CustomScrollbar>
  );

  const menu = [headerComponent, contentComponent];

  return (
    <ul className={styles.menu} ref={ref} {...mergeProps(menuProps, contextMenuProps)} tabIndex={-1}>
      {reverseMenuDirection ? menu.reverse() : menu}
    </ul>
  );
}

function getStyles(theme: GrafanaTheme2, reverseDirection?: boolean) {
  return {
    menu: css`
      background-color: ${theme.colors.background.primary};
      border: 1px solid ${theme.components.panel.borderColor};
      box-shadow: ${theme.shadows.z3};
      display: flex;
      flex-direction: column;
      list-style: none;
      max-height: 400px;
      max-width: 300px;
      min-width: 140px;
      transition: ${theme.transitions.create('opacity')};
      z-index: ${theme.zIndex.sidemenu};
    `,
    subtitle: css`
      background-color: transparent;
      border-${reverseDirection ? 'bottom' : 'top'}: 1px solid ${theme.colors.border.weak};
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.bodySmall.fontWeight};
      padding: ${theme.spacing(1)} ${theme.spacing(2)} ${theme.spacing(1)};
      text-align: left;
      white-space: nowrap;
    `,
    emptyMessage: css`
      font-style: italic;
      padding: ${theme.spacing(0.5, 2)};
    `,
  };
}
