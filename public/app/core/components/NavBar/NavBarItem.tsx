import React, { ReactNode } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { IconName, useTheme2 } from '@grafana/ui';
import { MenuButton } from './NavBarItemButton';
import { Item } from '@react-stately/collections';
import { NavBarMenuItem } from './NavBarMenuItem';
import { getNavBarItemWithoutMenuStyles, NavBarItemWithoutMenu } from './NavBarItemWithoutMenu';

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
  id: string;
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
  id,
  link,
}: Props) => {
  const theme = useTheme2();

  let menuItemsSorted;
  if (menuItems) {
    menuItemsSorted = reverseMenuDirection ? menuItems?.reverse() : menuItems;
  }
  const filteredItems = menuItemsSorted?.filter((item) => !item.hideFromMenu);
  const adjustHeightForBorder = filteredItems!.length === 0;
  const styles = getStyles(theme, isActive, adjustHeightForBorder, reverseMenuDirection);

  return showMenu ? (
    <div className={cx(styles.container, className)}>
      <MenuButton link={link} isActive={isActive} reverseDirection={reverseMenuDirection} menuItems={menuItems}>
        {!reverseMenuDirection && (
          <Item key={id} textValue={link.text}>
            <NavBarMenuItem target={target} text={label} url={url} onClick={onClick} styleOverrides={styles.header} />
          </Item>
        )}
        {menuSubTitle && reverseMenuDirection && (
          <Item key="subtitle" textValue={menuSubTitle}>
            <div className={styles.subtitle}>{menuSubTitle}</div>
          </Item>
        )}

        {filteredItems?.map((item, index) => {
          return (
            <Item key={`${item.id}-${index}`} textValue={item.text}>
              <NavBarMenuItem
                key={`${item.url}-${index}`}
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
        })}
        {reverseMenuDirection && (
          <Item key={id} textValue={link.text}>
            <NavBarMenuItem target={target} text={label} url={url} onClick={onClick} styleOverrides={styles.header} />
          </Item>
        )}
        {menuSubTitle && !reverseMenuDirection && (
          <Item key="subtitle" textValue={menuSubTitle}>
            <div className={styles.subtitle}>{menuSubTitle}</div>
          </Item>
        )}
      </MenuButton>
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
