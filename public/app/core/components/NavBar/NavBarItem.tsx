import { css, cx } from '@emotion/css';
import { useLingui } from '@lingui/react';
import { Item } from '@react-stately/collections';
import React from 'react';

import { GrafanaTheme2, locationUtil, NavMenuItemType, NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { toIconName, useTheme2 } from '@grafana/ui';

import { NavBarItemMenu } from './NavBarItemMenu';
import { NavBarItemMenuTrigger } from './NavBarItemMenuTrigger';
import { getNavBarItemWithoutMenuStyles } from './NavBarItemWithoutMenu';
import { NavBarMenuItem } from './NavBarMenuItem';
import { useNavBarContext } from './context';
import menuItemTranslations from './navBarItem-translations';
import { getNavModelItemKey } from './utils';

export interface Props {
  isActive?: boolean;
  className?: string;
  reverseMenuDirection?: boolean;
  link: NavModelItem;
}

const NavBarItem = ({ isActive = false, className, reverseMenuDirection = false, link }: Props) => {
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
    onClick?.();

    if (url) {
      if (!target && url.startsWith('/')) {
        locationService.push(locationUtil.stripBaseFromUrl(url));
      } else {
        window.open(url, target);
      }
    }
  };

  const translationKey = link.id && menuItemTranslations[link.id];
  const linkText = translationKey ? i18n._(translationKey) : link.text;

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
            const iconName = item.icon ? toIconName(item.icon) : undefined;
            const icon = item.showIconInNavbar && !isSection ? iconName : undefined;

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
