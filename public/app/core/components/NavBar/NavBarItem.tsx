import React, { ReactNode } from 'react';
import { Item } from '@react-stately/collections';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2, locationUtil, NavMenuItemType, NavModelItem } from '@grafana/data';
import { IconName, useTheme2 } from '@grafana/ui';
import { locationService } from '@grafana/runtime';

import { NavBarMenuItem } from './NavBarMenuItem';
import { getNavBarItemWithoutMenuStyles, NavBarItemWithoutMenu } from './NavBarItemWithoutMenu';
import { NavBarItemMenuTrigger } from './NavBarItemMenuTrigger';
import { NavBarItemMenu } from './NavBarItemMenu';
import { getNavModelItemKey } from './utils';
import { defineMessage, Trans } from '@lingui/macro';
import { MessageDescriptor } from '@lingui/core';

export interface Props {
  isActive?: boolean;
  children: ReactNode;
  className?: string;
  reverseMenuDirection?: boolean;
  showMenu?: boolean;
  link: NavModelItem;
}

// Keys MUST match the ID of the navigation item, defined in the backend.
// see pkg/api/index.go
const TRANSLATED_MENU_ITEMS: Record<string, MessageDescriptor> = {
  home: defineMessage({ id: 'nav.home', message: 'Home' }),
  dashboards: defineMessage({ id: 'nav.dashboards', message: 'Dashboards' }),
  'manage-dashboards': defineMessage({ id: 'nav.manage-dashboards', message: 'Browse' }),
  playlists: defineMessage({ id: 'nav.playlists', message: 'Playlists' }),
  snapshots: defineMessage({ id: 'nav.snapshots', message: 'Snapshots' }),
  'library-panels': defineMessage({ id: 'nav.library-panels', message: 'Library panels' }),
  'new-dashboard': defineMessage({ id: 'nav.new-dashboard', message: 'New dashboard' }),
  folder: defineMessage({ id: 'nav.folder', message: 'New folder' }),
  import: defineMessage({ id: 'nav.import', message: 'Import' }),
};

const NavBarItem = ({
  isActive = false,
  children,
  className,
  reverseMenuDirection = false,
  showMenu = true,
  link,
}: Props) => {
  const theme = useTheme2();
  const menuItems = link.children ?? [];
  const menuItemsSorted = reverseMenuDirection ? menuItems.reverse() : menuItems;
  const filteredItems = menuItemsSorted
    .filter((item) => !item.hideFromMenu)
    .map((i) => ({ ...i, menuItemType: NavMenuItemType.Item }));
  const adjustHeightForBorder = filteredItems.length === 0;
  const styles = getStyles(theme, adjustHeightForBorder, isActive);
  const section: NavModelItem = {
    ...link,
    children: filteredItems,
    menuItemType: NavMenuItemType.Section,
  };
  const items: NavModelItem[] = [section].concat(filteredItems);

  const onNavigate = (item: NavModelItem) => {
    const { url, target, onClick } = item;
    if (!url) {
      onClick?.();
      return;
    }

    if (!target && url.startsWith('/')) {
      locationService.push(locationUtil.stripBaseFromUrl(url));
    } else {
      window.open(url, target);
    }
  };

  return showMenu ? (
    <li className={cx(styles.container, className)}>
      <NavBarItemMenuTrigger item={section} isActive={isActive} label={link.text}>
        <NavBarItemMenu
          items={items}
          reverseMenuDirection={reverseMenuDirection}
          adjustHeightForBorder={adjustHeightForBorder}
          disabledKeys={['divider', 'subtitle']}
          aria-label={section.text}
          onNavigate={onNavigate}
        >
          {(item: NavModelItem) => {
            const translationKey = item.id && TRANSLATED_MENU_ITEMS[item.id];
            const itemText = translationKey ? <Trans id={translationKey.id} /> : item.text;

            if (item.menuItemType === NavMenuItemType.Section) {
              return (
                <Item key={getNavModelItemKey(item)} textValue={item.text}>
                  <NavBarMenuItem
                    target={item.target}
                    text={itemText}
                    url={item.url}
                    onClick={item.onClick}
                    styleOverrides={styles.header}
                  />
                </Item>
              );
            }

            return (
              <Item key={getNavModelItemKey(item)} textValue={item.text}>
                <NavBarMenuItem
                  isDivider={item.divider}
                  icon={item.icon as IconName}
                  onClick={item.onClick}
                  target={item.target}
                  text={itemText}
                  url={item.url}
                  styleOverrides={styles.item}
                />
              </Item>
            );
          }}
        </NavBarItemMenu>
      </NavBarItemMenuTrigger>
    </li>
  ) : (
    <NavBarItemWithoutMenu
      label={link.text}
      className={className}
      isActive={isActive}
      url={link.url}
      onClick={link.onClick}
      target={link.target}
      highlightText={link.highlightText}
    >
      {children}
    </NavBarItemWithoutMenu>
  );
};

export default NavBarItem;

const getStyles = (theme: GrafanaTheme2, adjustHeightForBorder: boolean, isActive?: boolean) => ({
  ...getNavBarItemWithoutMenuStyles(theme, isActive),
  header: css`
    color: ${theme.colors.text.primary};
    height: ${theme.components.sidemenu.width - (adjustHeightForBorder ? 2 : 1)}px;
    font-size: ${theme.typography.h4.fontSize};
    font-weight: ${theme.typography.h4.fontWeight};
    padding: ${theme.spacing(1)} ${theme.spacing(2)};
    white-space: nowrap;
    width: 100%;
  `,
  item: css`
    color: ${theme.colors.text.primary};
  `,
});
