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
import { getNavModelItemKey } from '../utils';
import { useLingui } from '@lingui/react';
import menuItemTranslations from '../navBarItem-translations';
import { useNavBarContext } from '../context';

export interface Props {
  isActive?: boolean;
  children: ReactNode;
  className?: string;
  reverseMenuDirection?: boolean;
  showMenu?: boolean;
  link: NavModelItem;
}

const NavBarItem = ({
  isActive = false,
  children,
  className,
  reverseMenuDirection = false,
  showMenu = true,
  link,
}: Props) => {
  const { i18n } = useLingui();
  const theme = useTheme2();
  const menuItems = link.children ?? [];
  const { menuIdOpen } = useNavBarContext();

  // Spreading `menuItems` here as otherwise we'd be mutating props
  const menuItemsSorted = reverseMenuDirection ? [...menuItems].reverse() : menuItems;
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

  const translationKey = link.id && menuItemTranslations[link.id];
  const linkText = translationKey ? i18n._(translationKey) : link.text;

  if (!showMenu) {
    return (
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
  } else {
    return (
      <li className={cx(styles.container, { [styles.containerHover]: section.id === menuIdOpen }, className)}>
        <NavBarItemMenuTrigger
          item={section}
          isActive={isActive}
          label={linkText}
          reverseMenuDirection={reverseMenuDirection}
        >
          <NavBarItemMenu
            items={items}
            reverseMenuDirection={reverseMenuDirection}
            adjustHeightForBorder={adjustHeightForBorder}
            disabledKeys={['divider', 'subtitle']}
            aria-label={section.text}
            onNavigate={onNavigate}
          >
            {(item: NavModelItem) => {
              const translationKey = item.id && menuItemTranslations[item.id];
              const itemText = translationKey ? i18n._(translationKey) : item.text;
              const isSection = item.menuItemType === NavMenuItemType.Section;
              const icon = item.showIconInNavbar && !isSection ? (item.icon as IconName) : undefined;

              return (
                <Item key={getNavModelItemKey(item)} textValue={item.text}>
                  <NavBarMenuItem
                    isDivider={!isSection && item.divider}
                    icon={icon}
                    target={item.target}
                    text={itemText}
                    url={item.url}
                    onClick={item.onClick}
                    styleOverrides={cx(styles.primaryText, { [styles.header]: isSection })}
                  />
                </Item>
              );
            }}
          </NavBarItemMenu>
        </NavBarItemMenuTrigger>
      </li>
    );
  }
};

export default NavBarItem;

const getStyles = (theme: GrafanaTheme2, adjustHeightForBorder: boolean, isActive?: boolean) => ({
  ...getNavBarItemWithoutMenuStyles(theme, isActive),
  containerHover: css({
    backgroundColor: theme.colors.action.hover,
    color: theme.colors.text.primary,
  }),
  primaryText: css({
    color: theme.colors.text.primary,
  }),
  header: css({
    height: `calc(${theme.spacing(6)} - ${adjustHeightForBorder ? 2 : 1}px)`,
    fontSize: theme.typography.h4.fontSize,
    fontWeight: theme.typography.h4.fontWeight,
    padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
    whiteSpace: 'nowrap',
    width: '100%',
  }),
});
