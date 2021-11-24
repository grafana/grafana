import React, { ReactNode } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2, NavMenuItemType, NavModelItem } from '@grafana/data';
import { IconName, useTheme2 } from '@grafana/ui';
import { Item } from '@react-stately/collections';
import { NavBarMenuItem } from './NavBarMenuItem';
import { getNavBarItemWithoutMenuStyles, NavBarItemWithoutMenu } from './NavBarItemWithoutMenu';
import { NavBarItemMenu, NavBarItemMenuTrigger } from './NavBarItemMenuTrigger';
import { getNavModelItemKey } from './utils';

export interface Props {
  isActive?: boolean;
  children: ReactNode;
  className?: string;
  label: string;
  menuItems?: NavModelItem[];
  menuSubTitle?: string;
  onClick?: () => void;
  reverseMenuDirection?: boolean;
  showMenu?: boolean;
  target?: HTMLAnchorElement['target'];
  url?: string;
  link: NavModelItem;
}

const NavBarItem = ({
  isActive = false,
  children,
  className,
  label,
  menuItems = [],
  menuSubTitle,
  onClick,
  reverseMenuDirection = false,
  showMenu = true,
  target,
  url,
  link,
}: Props) => {
  const theme = useTheme2();

  const menuItemsSorted = reverseMenuDirection ? menuItems.reverse() : menuItems;
  const filteredItems = menuItemsSorted
    .filter((item) => !item.hideFromMenu)
    .map((i) => ({ ...i, menuItemType: NavMenuItemType.Item }));
  const adjustHeightForBorder = filteredItems.length === 0;
  const styles = getStyles(theme, isActive, adjustHeightForBorder, reverseMenuDirection);
  const section: NavModelItem = {
    ...link,
    subTitle: menuSubTitle,
    children: filteredItems,
    menuItemType: NavMenuItemType.Section,
  };
  const disabledKeys = filteredItems.filter((item) => item.divider).map(getNavModelItemKey);
  // Disable all keys that are subtitle they should not be focusable
  disabledKeys.push('subtitle');
  const items: NavModelItem[] = [section].concat(filteredItems);

  return showMenu ? (
    <div className={cx(styles.container, className)}>
      <NavBarItemMenuTrigger item={section}>
        <NavBarItemMenu
          items={items}
          reverseMenuDirection={reverseMenuDirection}
          adjustHeightForBorder={adjustHeightForBorder}
          disabledKeys={disabledKeys}
        >
          {(item: NavModelItem) => {
            if (item.menuItemType === NavMenuItemType.Section) {
              return (
                <Item key={getNavModelItemKey(item)}>
                  <NavBarMenuItem
                    target={target}
                    text={label}
                    url={url}
                    onClick={onClick}
                    styleOverrides={styles.header}
                  />
                </Item>
              );
            }

            return (
              <Item key={getNavModelItemKey(item)}>
                <NavBarMenuItem
                  isDivider={item.divider}
                  icon={item.icon as IconName}
                  onClick={item.onClick}
                  target={item.target}
                  text={item.text}
                  url={item.url}
                  styleOverrides={styles.item}
                />
              </Item>
            );
          }}
        </NavBarItemMenu>
      </NavBarItemMenuTrigger>
    </div>
  ) : (
    <NavBarItemWithoutMenu
      label={label}
      className={className}
      isActive={isActive}
      url={url}
      onClick={onClick}
      target={target}
    >
      {children}
    </NavBarItemWithoutMenu>
  );
};

export default NavBarItem;

const getStyles = (
  theme: GrafanaTheme2,
  isActive: Props['isActive'],
  adjustHeightForBorder: boolean,
  reverseMenuDirection: Props['reverseMenuDirection']
) => ({
  ...getNavBarItemWithoutMenuStyles(theme, isActive),
  header: css`
    background-color: ${theme.colors.background.secondary};
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
  subtitle: css`
      border-${reverseMenuDirection ? 'bottom' : 'top'}: 1px solid ${theme.colors.border.weak};
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.bodySmall.fontWeight};
      padding: ${theme.spacing(1)} ${theme.spacing(2)} ${theme.spacing(1)};
      white-space: nowrap;
    `,
});
